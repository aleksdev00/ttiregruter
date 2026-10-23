import postgres from 'postgres';
import {postgresStatement,type DatabaseValue} from './postgres-sql.ts';
import {SUPABASE_ROOT_CA} from './supabase-root-ca.ts';

// Only server code obtains this adapter; browsers have no direct table grants.
type QueryResult = {rows: Record<string,unknown>[]; count:number};
export type PostgresExecutor = {
  query(sql:string,values:readonly DatabaseValue[]):Promise<QueryResult>;
  transaction<T>(run:(execute:PostgresExecutor['query'])=>Promise<T>):Promise<T>;
};
function d1Result<T>(result:QueryResult) {
  const rows=result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>{
    if(typeof value==='bigint') { const number=Number(value); if(!Number.isSafeInteger(number))throw new Error('Database integer exceeds the supported safe range.');return [key,number]; }
    return [key,value];
  })));
  return {success:true as const,results:rows as T[],meta:{changes:result.count,last_row_id:0,duration:0,served_by:'supabase-postgres'}};
}
class Statement {
  readonly sql:string; readonly values:readonly DatabaseValue[]; private executor:PostgresExecutor;
  constructor(executor:PostgresExecutor,sql:string,values:readonly DatabaseValue[]=[]){this.executor=executor;this.sql=sql;this.values=values;}
  bind(...values:DatabaseValue[]){return new Statement(this.executor,this.sql,values);}
  async all<T=Record<string,unknown>>(){const query=postgresStatement(this.sql,this.values);return d1Result<T>(await this.executor.query(query.sql,query.values));}
  async first<T=Record<string,unknown>>(column?:string):Promise<T|null>{const result=await this.all<Record<string,unknown>>();const row=result.results[0];return row?(column?row[column]:row) as T:null;}
  async run(){return this.all();}
}
export function createPostgresDatabase(executor:PostgresExecutor):D1Database {
  return {
    prepare(sql:string){return new Statement(executor,sql) as unknown as D1PreparedStatement;},
    async batch<T>(statements:D1PreparedStatement[]){
      return executor.transaction(async execute=>{
        const results=[]; let changes=0;
        for(const statement of statements){
          if(!(statement instanceof Statement))throw new Error('Database batch contains a foreign statement.');
          const query=postgresStatement(statement.sql,statement.values,changes);
          const result=await execute(query.sql,query.values);changes=result.count;
          results.push(d1Result<T>(result));
        }
        return results;
      });
    },
    exec(){throw new Error('Apply reviewed PostgreSQL migrations outside the application runtime.');},
  } as unknown as D1Database;
}
let database:D1Database|undefined;
export function getPostgresDatabase():D1Database|undefined {
  const url=process.env.SUPABASE_DATABASE_URL?.trim(); if(!url)return undefined;
  const parsed=new URL(url);
  if(!['postgres:','postgresql:'].includes(parsed.protocol)||!parsed.password)throw new Error('Configure a complete server-only SUPABASE_DATABASE_URL.');
  if(parsed.searchParams.has('sslmode')&&!['require','verify-full','verify-ca'].includes(parsed.searchParams.get('sslmode')!))throw new Error('PostgreSQL TLS cannot be disabled.');
  if(!database){
    // Supabase uses a project root CA that is not present in every serverless
    // runtime's default trust store. Keep full certificate and hostname
    // verification enabled while trusting only the Supabase root CA.
    const connectionUrl=new URL(url);connectionUrl.searchParams.delete('sslmode');connectionUrl.searchParams.delete('sslrootcert');
    const ca=process.env.SUPABASE_DATABASE_CA_CERT?.trim()||SUPABASE_ROOT_CA;
    const client=postgres(connectionUrl.toString(),{ssl:{ca,rejectUnauthorized:true},prepare:false,max:3,idle_timeout:20,connect_timeout:10,types:{bigint:postgres.BigInt,numeric:{to:1700,from:[1700],serialize:String,parse:Number}},connection:{application_name:'tti-recruiter',search_path:'public'}});
    // Keep the configured parser types on both the root client and transaction
    // client. postgres.Sql's default generic is Sql<{}>, which is incompatible
    // with this client when TypeScript uses the configured bigint/numeric types.
    const execute=(sql:typeof client)=>async(query:string,values:readonly DatabaseValue[])=>{
      try {
        const result=await sql.unsafe(query,values as postgres.ParameterOrJSON<never>[]);
        return {rows:Array.from(result) as Record<string,unknown>[],count:result.count};
      } catch(error) {
        if(error instanceof postgres.PostgresError&&error.code==='23514'&&['tti_revision_guard','mutation_must_claim_revision'].includes(error.constraint_name??''))throw new Error('mutation_must_claim_revision: records changed');
        throw error;
      }
    };
    database=createPostgresDatabase({query:execute(client),transaction:run=>client.begin(async sql=>run(execute(sql as unknown as typeof client))) as Promise<Awaited<ReturnType<typeof run>>>});
  }
  return database;
}
