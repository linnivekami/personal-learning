import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {emptyState,applyEvent,masteryFor} from '../shared/core';
import {sampleCourse} from '../shared/sample';
describe('packaged Skill guardrails',()=>{
 it('audits verification dates, revision, reviews and completed tasks, not only grades',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pl-skill-'));
  try{const state=emptyState();state.revision=100;state.concepts={conditional:{conceptId:'conditional',mastery:0,lastVerified:'2099-01-01',reviewStep:0,nextReview:'2099-01-01',weaknesses:[],effectiveStrategies:{},failedStrategies:{}}};
  state.nextAction={id:'stale',conceptId:'conditional',kind:'review',title:'completed task remains',reason:'',completed:true,estimatedMinutes:10};
  writeFileSync(join(dir,'state.json'),JSON.stringify(state));writeFileSync(join(dir,'concepts.json'),JSON.stringify(sampleCourse.concepts));
  const r=spawnSync(process.execPath,['skill/scripts/state.mjs','audit','--state',join(dir,'state.json'),'--concepts',join(dir,'concepts.json')],{encoding:'utf8'});expect(r.status).toBe(1);const report=JSON.parse(r.stdout);expect(report.errors).toContain('revision');expect(report.errors).toContain('conditional:lastVerified');expect(report.errors).toContain('conditional:nextReview');expect(report.errors).toContain('nextAction:completed');
  }finally{rmSync(dir,{recursive:true,force:true})}
 });
});
