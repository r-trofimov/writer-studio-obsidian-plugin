const {setIcon}=require('obsidian');
const {setup,imageUrl,CharacterEditorModal}=require('./character-library');
function renderPersonaSettings(view,root){
 root.createEl('h3',{text:'Персонажи'});
 root.createEl('p',{text:'Настройте имена, аватары и системные промпты собеседников. Изменения используются в чате с персонажем и в Круговороте.',cls:'ws-subtitle'});
 const rows=root.createDiv({cls:'ws-character-library'});
 for(const character of setup(view.plugin.settings)){
  const row=rows.createDiv({cls:'ws-character-library-row'}),url=imageUrl(view,character);
  if(url)row.createEl('img',{cls:'ws-character-library-avatar',attr:{src:url,alt:''}});
  const details=row.createDiv({cls:'ws-character-library-details'});details.createEl('strong',{text:character.name});
  if(character.description)details.createEl('span',{text:character.description,cls:'ws-hint'});
  const edit=row.createEl('button',{cls:'ws-character-library-edit',attr:{'aria-label':'Редактировать '+character.name,title:'Редактировать'}});setIcon(edit,'pencil');edit.onclick=()=>new CharacterEditorModal(view.app,view,character,()=>{}).open();
 }
 const add=root.createEl('button',{text:'＋ Создать персонажа',cls:'ws-persona-add'});add.onclick=()=>new CharacterEditorModal(view.app,view,null,()=>{}).open();
}
module.exports={renderPersonaSettings};
