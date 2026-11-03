import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const book = JSON.parse(await fs.readFile(path.join(root,'book.json'),'utf8'));
const community = JSON.parse(await fs.readFile(path.join(root,'community.json'),'utf8'));
const audit = JSON.parse(await fs.readFile(path.join(root,'artifacts/content-audit.json'),'utf8'));
const original = await fs.readFile(path.join(root,'source/handout.en.txt'),'utf8');
const expected = [...original.matchAll(/Problem\s*\(([^)]+)\)/g)].map(m=>m[1]);
assert.equal(new Set(expected).size,expected.length,'Repeated source exercises');
assert.deepEqual(audit.problems.map(p=>p.id).sort(),expected.sort(),'Exercise coverage mismatch');
const sourcePoints = [...original.matchAll(/Problem\s*\(([^)]+)\):[\s\S]*?\((\d+)\s+points?\)/g)];
assert.equal(sourcePoints.length,expected.length,'Unable to read all source point values');
for (const match of sourcePoints) assert.equal(audit.problems.find(p=>p.id===match[1])?.points,Number(match[2]),'Point value mismatch: '+match[1]);
assert.equal(new Set(audit.problems.map(p=>p.id)).size,audit.problems.length,'Duplicate exercise IDs');
assert.deepEqual(audit.equations.sort((a,b)=>a-b),Array.from({length:29},(_,i)=>i+1),'Missing or duplicate numbered equation');
const sumPoints = audit.problems.reduce((sum,p)=>sum+p.points,0);
for (const chapter of book.chapters) {
  const file = path.join(root,'dist/assignment1',chapter.slug,'index.html');
  const html = await fs.readFile(file,'utf8');
  assert(!html.includes('katex-error'),'Math rendering failed: '+chapter.slug);
  assert(!html.includes('data-excerpt='),'Unresolved source excerpt: '+chapter.slug);
  assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,'Unexpected page headings: '+chapter.slug);
  assert(html.includes('id="original"'),'Missing original: '+chapter.slug);
  assert(html.includes('href="'+community.chapters[chapter.slug]+'"'),'Missing chapter discussion: '+chapter.slug);
  const feedback = [...html.matchAll(/class="feedback-link" href="([^"]+)"/g)];
  assert.equal(feedback.length,2,'Chapter feedback entry points: '+chapter.slug);
  for (const match of feedback) {
    const issue = new URL(match[1].replace(/&amp;/g,'&'));
    assert.equal(issue.origin,'https://github.com');
    assert.equal(issue.pathname,'/iefnaf/cs336-wiki/issues/new');
    assert.equal(issue.searchParams.get('template'),'error-report.yml');
    assert.equal(issue.searchParams.get('page_url'),'https://cs336.wiki/assignment1/'+chapter.slug+'/');
    assert(issue.searchParams.get('chapter').includes(chapter.title));
    assert(issue.searchParams.get('version').includes(book.version));
    assert(!issue.searchParams.has('labels'),'Public feedback links must not require label permissions');
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'Duplicate anchors: '+chapter.slug);
  for (const link of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = link[1];
    if (!href.startsWith('/')) continue;
    const [pathname,anchor] = href.split('#');
    const target = path.join(root,'dist',pathname,pathname.endsWith('/')?'index.html':'');
    await fs.access(target);
    if (anchor && !pathname.endsWith('.pdf')) {
      const targetHTML = await fs.readFile(target,'utf8');
      assert(targetHTML.includes('id="'+anchor+'"'),'Broken anchor: '+href);
    }
  }
}
const communityHTML = await fs.readFile(path.join(root,'dist/community/index.html'),'utf8');
assert.equal((communityHTML.match(/class="discussion-row"/g)||[]).length,book.chapters.length,'Community discussion directory');
assert(communityHTML.includes('data-chapter="" data-page="community"'),'Community must not overwrite reading position');
assert(communityHTML.includes('href="https://cs336.wiki/community/"'),'Community canonical URL');
const summary = { chapters:book.chapters.length,exercises:expected.length,total_points:sumPoints,equations:audit.equations.length,chinese_characters:audit.words,source_sha256:book.source_sha256,checks:['All source exercise IDs preserved','All 29 numbered equations preserved','Local links and anchors resolve','Source excerpts resolved','No KaTeX errors'] };
await fs.writeFile(path.join(root,'artifacts/validation.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
