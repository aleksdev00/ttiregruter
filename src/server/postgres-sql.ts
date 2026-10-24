// Compatibility for the application's existing, server-authored D1 statements.
// Values remain parameters. This is not a SQL endpoint or a general SQL parser.
export type DatabaseValue = string | number | bigint | null | ArrayBuffer | ArrayBufferView;
type Token = { value: string; kind: 'word' | 'quoted' | 'symbol' | 'parameter' };
const numericPaths = new Set(['$.revision', '$.createdAt', '$.urgent', '$.manualEdited', '$.isDemo', '$.rawFields.contact_blocked', '$.rawFields.demo_contact']);
function tokens(sql: string): Token[] {
  const output: Token[] = [];
  for (let i = 0; i < sql.length;) {
    if (/\s/.test(sql[i])) { i++; continue; }
    if (sql.startsWith('--', i) || sql.startsWith('/*', i)) throw new Error('SQL comments are not supported by the runtime adapter.');
    const start = i, quote = sql[i];
    if (quote === "'" || quote === '"' || quote === '`') {
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i++] === quote) { if (sql[i] === quote) i++; else { closed = true; break; } }
      }
      if (!closed) throw new Error('Unterminated SQL literal.');
      const value = sql.slice(start, i);
      output.push({value: quote === '`' ? '"' + value.slice(1, -1) + '"' : value, kind: 'quoted'});
    } else if (/[A-Za-z_0-9]/.test(quote)) {
      while (i < sql.length && /[A-Za-z_0-9]/.test(sql[i])) i++;
      output.push({value: sql.slice(start, i), kind: 'word'});
    } else if (['>=','<=','!=','<>','||'].includes(sql.slice(i,i+2))) {
      output.push({value:sql.slice(i,i+2),kind:'symbol'}); i+=2;
    } else { i++; output.push({value: quote, kind: quote === '?' ? 'parameter' : 'symbol'}); }
  }
  return output;
}
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
export function postgresStatement(sql: string, values: readonly DatabaseValue[] = [], changes = 0) {
  const list = tokens(sql);
  if (list.at(-1)?.value === ';') list.pop();
  if (list.some(t => t.value === ';')) throw new Error('Only one statement is allowed.');
  let parameter = 0;
  for (const token of list) if (token.kind === 'parameter') token.value = '$' + (++parameter);
  if (parameter !== values.length) throw new Error('SQL parameter count does not match bound values.');
  const typed = (s: string) => s.replace(/'(?:''|[^'])*'|\$(\d+)\b/g, (match, n: string | undefined) => {
    if (!n) return match;
    const value = values[Number(n) - 1];
    return match + (typeof value === 'number' ? (Number.isInteger(value) ? '::bigint' : '::double precision') : typeof value === 'bigint' ? '::bigint' : value instanceof ArrayBuffer || ArrayBuffer.isView(value) ? '::bytea' : '::text');
  });
  const path = (s: string) => {
    if (!/^'\$(?:\.[A-Za-z_][A-Za-z_0-9]*)+'$/.test(s)) throw new Error('Unsupported JSON path in server SQL.');
    return { name: s.slice(1, -1), sql: 'ARRAY[' + s.slice(3, -1).split('.').map(literal).join(',') + ']::text[]' };
  };
  function render(start: number, end: number): string {
    const output: string[] = [];
    for (let i = start; i < end; i++) {
      const t = list[i], name = t.value.toLowerCase();
      if (t.kind === 'word' && list[i + 1]?.value === '(' && ['json_extract','json_set','json_each','json_type','json','json_object','json_group_array','unixepoch','changes','max','min'].includes(name)) {
        const args: string[] = []; let depth = 0, begin = i + 2, j = begin;
        for (; j < end; j++) {
          if (list[j].value === '(') depth++;
          if (list[j].value === ')') { if (depth === 0) { if (j > begin) args.push(render(begin, j)); break; } depth--; }
          if (list[j].value === ',' && depth === 0) { args.push(render(begin, j)); begin = j + 1; }
        }
        if (j === end) throw new Error('Unclosed SQL function.');
        i = j;
        if (name === 'json_extract' || name === 'json_type') {
          if (args.length !== 2) throw new Error('Expected one JSON path.');
          const p = path(args[1]), text = '((' + args[0] + ')::jsonb #>> ' + p.sql + ')';
          if (name === 'json_type') output.push("(CASE WHEN jsonb_typeof((" + args[0] + ')::jsonb #> ' + p.sql + ")='boolean' THEN " + text + ' ELSE jsonb_typeof((' + args[0] + ')::jsonb #> ' + p.sql + ') END)');
          else if (numericPaths.has(p.name)) output.push('(CASE ' + text + " WHEN 'true' THEN 1 WHEN 'false' THEN 0 ELSE " + text + '::numeric END)');
          else output.push(text);
        } else if (name === 'json_set') {
          if (args.length < 3 || args.length % 2 !== 1) throw new Error('Invalid JSON update.');
          let result = '(' + args[0] + ')::jsonb';
          for (let k = 1; k < args.length; k += 2) result = 'tti_private.json_set(' + result + ',' + path(args[k]).sql + ',(jsonb_build_array(' + typed(args[k + 1]) + ')->0))';
          output.push('(' + result + ')::text');
        // The postgres-js driver can bind a JSON-looking string to a placeholder
        // whose inferred server type is jsonb as JSON, which double-encodes it
        // as a scalar string. Force the bound value through text before parsing
        // it so JSON arrays passed by json_each(?) stay arrays in production.
        } else if (name === 'json_each') output.push('jsonb_array_elements_text(((' + args[0] + ')::text)::jsonb)');
        else if (name === 'json') output.push('(' + args[0] + ')::jsonb');
        else if (name === 'json_object') output.push('(jsonb_build_object(' + args.map(typed).join(',') + '))::text');
        else if (name === 'json_group_array') output.push("COALESCE(jsonb_agg((" + args[0] + ")::jsonb),'[]'::jsonb)::text");
        else if (name === 'unixepoch') output.push('(floor(extract(epoch FROM now()))::bigint)');
        else if (name === 'changes') output.push(String(changes));
        else output.push((args.length > 1 ? name === 'max' ? 'GREATEST' : 'LEAST' : name) + '(' + args.join(',') + ')');
      } else if (t.kind === 'word' && (name === 'sqlite_master' || name === 'sqlite_schema')) {
        output.push("(SELECT table_name AS name,'table'::text AS type FROM information_schema.tables WHERE table_schema='public')");
      } else output.push(t.value);
    }
    // Joining tokens never alters the content of quoted literals.
    return output.join(' ');
  }
  let query = render(0, list.length);
  if (/^INSERT OR IGNORE INTO /i.test(query)) query = query.replace(/^INSERT OR IGNORE INTO /i, 'INSERT INTO ') + ' ON CONFLICT DO NOTHING';
  if (/^INSERT OR REPLACE INTO /i.test(query)) {
    const match = /^INSERT OR REPLACE INTO (application_attributions|export_deliveries) \( ([\w ,]+) \)/i.exec(query);
    if (!match) throw new Error('Unreviewed replace statement. Use an explicit upsert.');
    const columns = match[2].split(',').map(s => s.trim()), key = match[1].toLowerCase() === 'application_attributions' ? 'application_id' : 'id';
    query = query.replace(/^INSERT OR REPLACE INTO /i, 'INSERT INTO ') + ' ON CONFLICT(' + key + ') DO UPDATE SET ' + columns.filter(c => c !== key).map(c => c + '=excluded.' + c).join(',');
  }
  // SQLite's GLOB patterns in the schema inspection use literal underscores.
  query = query.replace(/NOT GLOB 'sqlite_\*'/g, "NOT LIKE 'sqlite\\_%' ESCAPE '\\'").replace(/NOT GLOB '_\*'/g, "NOT LIKE '\\_%' ESCAPE '\\'");
  if (/\bPRAGMA\b|\bGLOB\b|\bAS BLOB\b/i.test(query)) throw new Error('Legacy export SQL is unavailable on PostgreSQL. Use a native PostgreSQL backup.');
  return {sql: query, values};
}
