const {Notice,MarkdownView,TFile}=require('obsidian');
const GRAMMAR='Исправь только орфографические и пунктуационные ошибки. Не меняй слова, порядок слов, смысл, стиль, абзацы и форматирование, кроме необходимых исправлений ошибок. Точно сохрани Markdown-разметку, ссылки, переносы строк и пустые строки. Верни только исправленный текст без пояснений, кавычек и предисловий. Если ошибок нет, верни исходный текст.';
function paragraphsForCheck(text){const result=[];const pattern=/[^\r\n]+(?:\r?\n[^\r\n]+)*/g;let m,inFence=false,frontmatter=text.startsWith('---\n')||text.startsWith('---\r\n'),first=true;while((m=pattern.exec(text))){const part=m[0];if(first&&frontmatter){first=false;continue}first=false;if(frontmatter){if(/^---\s*$/m.test(part))frontmatter=false;continue}const lines=part.split(/\r?\n/);if(lines.some(l=>/^\s*(?:`{3,}|~{3,})/.test(l))){for(const l of lines)if(/^\s*(?:`{3,}|~{3,})/.test(l))inFence=!inFence;continue}if(inFence||/^[ \t]*(?:#|>|[-*+]\s|\d+[.)]\s|\|)/m.test(part)||/[\[\]`]|!\[|\[\[/.test(part))continue;if(part.trim())result.push({start:m.index,text:part})}return result}
// Keep frontmatter and fenced code unchanged, and gather neighboring paragraphs.
function chunksForCheck(text, limit=300){
 const protectedRanges=[];
 const front=text.match(/^---[ \t]*\r?\n[\s\S]*?^---[ \t]*(?:\r?\n|$)/m);
 if(front&&front.index===0)protectedRanges.push([0,front[0].length]);
 const fences=/^[ \t]{0,3}(`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)/gm;
 let match,open=null;
 while((match=fences.exec(text))){
  if(protectedRanges.some(([a,b])=>match.index>=a&&match.index<b))continue;
  const marker=match[1];
  if(!open)open={start:match.index,char:marker[0],length:marker.length};
  else if(marker[0]===open.char&&marker.length>=open.length){protectedRanges.push([open.start,fences.lastIndex]);open=null}
 }
 if(open)protectedRanges.push([open.start,text.length]);
 protectedRanges.sort((a,b)=>a[0]-b[0]);
 const result=[];
 function segment(start,end){
  const part=text.slice(start,end), paragraphs=/[^\r\n]+(?:\r?\n(?![ \t]*\r?\n)[^\r\n]+)*/g;
  let m,current=null;
  const flush=()=>{if(current){result.push({start:current.start,text:text.slice(current.start,current.end)});current=null}};
  while((m=paragraphs.exec(part))){
   let a=start+m.index,b=a+m[0].length;
   if(!m[0].trim())continue;
   while(b-a>limit){
    flush();const sample=text.slice(a,a+limit);let cut=0;
    for(const hit of sample.matchAll(/[.!?…]["»”)]*(?=\s)/g))cut=hit.index+hit[0].length;
    if(!cut){const ws=/\s+/g;let hit;while((hit=ws.exec(sample)))if(hit.index>0)cut=hit.index}
    if(!cut)cut=limit;
    if(cut>0&&/[\uD800-\uDBFF]/.test(text[a+cut-1])&&/[\uDC00-\uDFFF]/.test(text[a+cut]))cut--;
    result.push({start:a,text:text.slice(a,a+cut)});a+=cut;
    while(a<b&&/\s/.test(text[a]))a++;
   }
   if(a>=b)continue;
   if(current&&b-current.start<=limit)current.end=b;
   else{flush();current={start:a,end:b}}
  }
  flush();
 }
 let cursor=0;for(const [start,end] of protectedRanges){if(start>cursor)segment(cursor,start);cursor=Math.max(cursor,end)}if(cursor<text.length)segment(cursor,text.length);
 return result;
}
function safeCorrection(a,b){if(!b||a.includes('\n')!==b.includes('\n'))return false;const words=x=>x.match(/[\p{L}\p{N}]+/gu)||[];const x=words(a),y=words(b);if(x.length!==y.length)return false;let differences=0;for(let i=0;i<x.length;i++){const left=x[i].toLocaleLowerCase(),right=y[i].toLocaleLowerCase();if(left===right)continue;differences++;if(Math.abs(left.length-right.length)>2)return false;let prev=Array.from({length:right.length+1},(_,j)=>j);for(let j=1;j<=left.length;j++){const next=[j];for(let k=1;k<=right.length;k++)next[k]=Math.min(next[k-1]+1,prev[k]+1,prev[k-1]+(left[j-1]===right[k-1]?0:1));prev=next}if(prev[right.length]>Math.max(2,Math.ceil(left.length*.4)))return false}return differences<=Math.max(1,Math.floor(x.length*.2))&&b.length<=a.length*1.25+4}
function correctionDiff(original,corrected){
 const split=text=>text.match(/[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu)||[];
 const a=split(original),b=split(corrected),n=a.length,m=b.length,ops=[];
 if(n*m>1500000){let p=0;while(p<n&&p<m&&a[p]===b[p])p++;let q=0;while(q<n-p&&q<m-p&&a[n-1-q]===b[m-1-q])q++;if(p)ops.push({type:'same',text:a.slice(0,p).join('')});if(n-p-q)ops.push({type:'removed',text:a.slice(p,n-q).join('')});if(m-p-q)ops.push({type:'added',text:b.slice(p,m-q).join('')});if(q)ops.push({type:'same',text:a.slice(n-q).join('')});return ops}
 const cols=m+1,table=new Uint32Array((n+1)*cols);for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)table[i*cols+j]=a[i]===b[j]?1+table[(i+1)*cols+j+1]:Math.max(table[(i+1)*cols+j],table[i*cols+j+1]);
 const add=(type,text)=>{const last=ops[ops.length-1];if(last&&last.type===type)last.text+=text;else ops.push({type,text})};let i=0,j=0;while(i<n||j<m){if(i<n&&j<m&&a[i]===b[j]){add('same',a[i]);i++;j++}else if(j<m&&(i===n||table[i*cols+j+1]>table[(i+1)*cols+j])){add('added',b[j++])}else{add('removed',a[i++])}}return ops
}
function createGrammarMethods({completion}){return class GrammarMethods {
 chooseFile(){this.pickContext(this.filePath?[this.filePath]:[],refs=>{const path=refs[0]||'';if(path!==this.filePath){this.fileProgress={done:0,total:0};this.fileStatus=''}this.filePath=path;this.render()},true)}
 currentFile(){const f=this.app.vault.getAbstractFileByPath(this.filePath);if(!(f instanceof TFile)||f.extension!=='md')throw Error('Прикрепите существующую Markdown-заметку');return f}
 editorFor(file){const leaves=this.app.workspace.getLeavesOfType('markdown').filter(l=>l.view instanceof MarkdownView&&l.view.file?.path===file.path);return leaves.length?leaves[0].view.editor:null}
 async fileText(file){const ed=this.editorFor(file);return ed?ed.getValue():await this.app.vault.read(file)}
 attachRow(root){const refs=this.filePath?[this.filePath]:[];const heading=root.createDiv({cls:'ws-file-picker-heading'});const choose=heading.createEl('button',{text:'＋ Выбрать файл для проверки',cls:'ws-action-quiet ws-context-add'});choose.disabled=this.fileBusy;choose.onclick=()=>this.chooseFile();if(refs.length)this.renderAttachedContext(root,refs,selected=>{this.filePath=selected[0]||'';this.fileProgress={done:0,total:0};this.fileStatus='';this.render()},this.fileBusy)}

 renderGrammar(root){root.createEl('h3',{text:'Поправить грамотность'});root.createEl('p',{text:'Орфография и пунктуация без перефразирования.',cls:'ws-subtitle'});root.createEl('div',{text:'ИСХОДНЫЙ ТЕКСТ',cls:'ws-eyebrow ws-label'});const input=root.createEl('textarea',{cls:'ws-source',attr:{'aria-label':'Текст для проверки',placeholder:'Вставьте фрагмент для проверки…'}});input.value=this.grammarSource;input.disabled=this.grammarBusy;input.oninput=()=>{this.grammarSource=input.value;go.disabled=this.grammarBusy||!input.value.trim()};const go=root.createEl('button',{text:this.grammarBusy?'Проверяю…':'Исправить грамотность',cls:'mod-cta ws-primary ws-grammar-run'});go.disabled=this.grammarBusy||!this.grammarSource.trim();go.onclick=()=>this.checkGrammar();const line=root.createDiv({cls:'ws-divider-label'});line.createEl('span',{text:'РЕЗУЛЬТАТ'});if(this.grammarResult){const operations=correctionDiff(this.grammarOriginal,this.grammarResult);const preview=root.createDiv({cls:'ws-correction-preview',attr:{'aria-label':'Исправленный текст',role:'textbox','aria-readonly':'true',tabindex:'0'}});for(const op of operations)if(op.type!=='removed')preview.createEl(op.type==='added'?'mark':'span',{text:op.text,cls:op.type==='added'?'ws-correction-mark':''});const removed=operations.filter(op=>op.type==='removed'&&op.text.trim());if(removed.length){const details=root.createEl('details',{cls:'ws-removed-details'});details.createEl('summary',{text:'Удалено: '+removed.length});for(const op of removed)details.createEl('span',{text:op.text,cls:'ws-deleted-item'})}const edit=root.createEl('button',{text:this.grammarEditing?'Готово':'Редактировать результат',cls:'ws-action-quiet'});edit.onclick=()=>{this.grammarEditing=!this.grammarEditing;this.render()};if(this.grammarEditing){const out=root.createEl('textarea',{cls:'ws-output ws-grammar-output',attr:{'aria-label':'Редактирование результата'}});out.value=this.grammarResult;out.oninput=()=>{this.grammarResult=out.value}}else root.createEl('p',{text:'Цветом отмечены новые или изменённые фрагменты.',cls:'ws-hint'})}else root.createDiv({text:'Здесь появится исправленный текст',cls:'ws-correction-preview is-empty'});}
 async checkGrammar(){if(this.grammarBusy||!this.grammarSource.trim())return;const source=this.grammarSource;this.grammarBusy=true;this.render();try{this.grammarResult=await completion(this.profile(),GRAMMAR,source);this.grammarOriginal=source;this.grammarEditing=false}catch(e){new Notice('Проверка: '+e.message,10000)}finally{this.grammarBusy=false;this.render()}}
 renderFile(root){const block=root.createDiv({cls:'ws-grammar-file-mode'});block.createEl('h3',{text:'Поправить весь файл'});block.createEl('p',{text:'Исправленная заметка сохранится в корне папки проекта.',cls:'ws-subtitle'});this.attachRow(block);const b=block.createEl('button',{text:this.fileBusy?'Остановить проверку':'Поправить файл',cls:this.fileBusy?'ws-primary ws-file-run':'mod-cta ws-primary ws-file-run'});b.disabled=!this.fileBusy&&!this.filePath;b.onclick=()=>{if(this.fileBusy){this.fileStop=true;this.fileStatus='Остановка после текущего запроса…';this.render()}else this.checkFile()};if(this.fileProgress.total){const section=block.createDiv({cls:'ws-progress'});section.createEl('span',{text:'Обработано: '+this.fileProgress.done+' из '+this.fileProgress.total,cls:'ws-progress-label'});const bar=section.createEl('progress',{attr:{max:String(this.fileProgress.total),value:String(this.fileProgress.done),'aria-label':'Прогресс проверки файла'}});bar.value=this.fileProgress.done;bar.max=this.fileProgress.total}if(this.fileStatus)block.createEl('p',{text:this.fileStatus,cls:'ws-file-status'})}
 async checkFile(){
  if(this.fileBusy)return;this.fileBusy=true;this.fileStop=false;this.fileProgress={done:0,total:0};this.fileStatus='Подготовка…';this.render();
  try{
   const file=this.currentFile(),original=await this.fileText(file),chunks=chunksForCheck(original);
   this.fileProgress={done:0,total:chunks.length};

   let expected=original,delta=0;
   for(let i=0;i<chunks.length;i++){
    if(this.fileStop)break;
    this.fileStatus='Проверяется часть '+(i+1)+' из '+chunks.length+'…';this.render();
    const part=chunks[i],answer=await completion(this.profile(),GRAMMAR,part.text);
    if(this.fileStop)break;
    if(typeof answer!=='string'||!answer.trim())throw Error('Модель вернула пустой ответ');
    const start=part.start+delta,end=start+part.text.length,next=expected.slice(0,start)+answer+expected.slice(end);
    expected=next;delta+=answer.length-part.text.length;this.fileProgress.done=i+1;this.render();
   }
   if(this.fileStop){this.fileStatus='Проверка остановлена. Новый файл не создан.';return}
   const output=await this.plugin.projectStorage.createUnique(this.plugin.activeProject().folder,file.basename+' (грамотность исправлено)',expected);
   this.fileStatus='Готово. Исправленная заметка: '+output.path;
  }catch(e){this.fileStatus='Остановлено: '+e.message;new Notice(this.fileStatus,10000)}finally{this.fileBusy=false;this.render()}
 }

}}
module.exports={paragraphsForCheck,chunksForCheck,safeCorrection,correctionDiff,createGrammarMethods};
