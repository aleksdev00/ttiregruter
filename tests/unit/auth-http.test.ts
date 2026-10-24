import test from 'node:test';
import assert from 'node:assert/strict';
import {authRequest} from '../../src/domain/auth-http.ts';

test('all recruiter auth actions use the JSON API routes served by the application',async()=>{
 const original=globalThis.fetch;
 const routes:string[]=[];
 globalThis.fetch=async(input,init)=>{
  const route=String(input);routes.push(route);
  const value=route.endsWith('/login')?{mustChangePassword:true}:undefined;
  return new Response(JSON.stringify({ok:true,...(value?{value}:{})}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  for(const action of ['login','forgot-password','reset-password','change-password','logout'] as const)
   await authRequest(action,{email:'recruiter@example.com',password:'new-password'});
 }finally{globalThis.fetch=original;}
 assert.deepEqual(routes,[
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/change-password',
  '/api/auth/logout',
 ]);
});
