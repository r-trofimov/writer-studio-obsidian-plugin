const {setIcon,Modal,Notice}=require('obsidian');
const {ContextPicker}=require('./context-picker');
const {CHAT_DIRS}=require('./project-storage');
function renderChatHeader(root,title){const bar=root.createDiv({cls:'ws-chat-headingbar'});bar.createDiv({cls:'ws-chat-heading'}).createEl('h3',{text:title});return bar}
function renderChatLoad(bar,view,kind,disabled=false){const button=bar.createEl('button',{cls:'ws-chat-manage ws-chat-load',attr:{title:'Загрузить чат','aria-label':'Загрузить чат'}});setIcon(button,'folder-open');button.disabled=disabled;button.onclick=()=>{const modal=new Modal(view.app);modal.onOpen=()=>{modal.modalEl?.classList.add('ws-own-modal','ws-chat-load-modal');modal.titleEl.setText('Загрузить чат');modal.contentEl.createEl('p',{text:'Вы можете загрузить сохранённый чат. Если файл редактировался вручную, он может загрузиться с ошибками.'});modal.contentEl.createEl('button',{text:'Выбрать файл'}).onclick=()=>{modal.close();const project=view.plugin.activeProject();if(!project){new Notice('Выберите проект');return}const dir=project.folder+'/_WriterStudio/'+CHAT_DIRS[kind];new ContextPicker(view.app,[],async refs=>{if(!refs.length)return;try{if(view.plugin.activeProject()?.id!==project.id)throw Error('Проект изменился. Выберите файл заново.');const path=refs[0];if(!path.startsWith(dir+'/'))throw Error('Выберите файл этого вида чата в папке текущего проекта.');const found=(await view.plugin.projectStorage.loadChats(project,kind)).find(item=>item.markdownPath===path);if(!found)throw Error('Не удалось прочитать чат. Файл может быть повреждён или иметь другой формат.');const keys={chat:['chatSessions','chatActiveId'],characterChat:['characterChatTabs','characterChatTabActive'],roundtable:['roundtableTabs','roundtableActiveId'],collector:['collectorTabs','collectorActiveId'],collectorPlus:['collectorPlusTabs','collectorPlusActiveId']};const [listKey,activeKey]=keys[kind],settings=view.plugin.settings;settings[listKey]??=[];const existing=settings[listKey].find(tab=>tab.id===found.id);if(existing){if(existing.markdownPath&&existing.markdownPath!==path)throw Error('Другой чат с таким идентификатором уже открыт.');existing.archived=false}else{found.archived=false;settings[listKey].push(found)}settings[activeKey]=found.id;if(kind==='collector')view.collectorState=null;await view.plugin.saveSettings();view.render()}catch(e){new Notice('Не удалось загрузить чат: '+e.message,12000)}},true,{rootPath:dir}).open()}};modal.open()};return button}
// Общие элементы чатов. Режим передаёт данные и обработчики своих действий.
function renderTabs(root,options){const tabs=root.createDiv({cls:'ws-conversation-tabs',attr:{'aria-label':options.ariaLabel||'Открытые чаты'}});for(const tab of options.tabs.filter(t=>!t.archived)){const title=options.title?options.title(tab):tab.title;const entry=tabs.createDiv({cls:'ws-conversation-tab'+(tab.id===options.activeId?' is-active':'')});entry.dataset.wsProcessSession=tab.id;entry.dataset.wsProcessKind=options.kind;const select=entry.createEl('button',{text:(tab.favorite?'★ ':'')+title,cls:'ws-conversation-select',attr:{title}});select.disabled=!!options.selectDisabled?.(tab);select.onclick=()=>options.onSelect(tab);const close=entry.createEl('button',{text:'×',cls:'ws-conversation-close',attr:{title:'Закрыть '+title,'aria-label':'Закрыть '+title}});close.disabled=!!options.closeDisabled?.(tab);close.onclick=()=>{const session=options.sessionForClose?.(tab)??tab;if(!isLastEmptyTab(options.tabs,session,options.sessionFields))return options.onClose(tab)}}const add=tabs.createEl('button',{text:'＋',cls:'ws-conversation-add',attr:{title:options.addTitle||'Новый чат','aria-label':options.addTitle||'Новый чат'}});add.disabled=!!options.addDisabled;add.onclick=options.onAdd;return tabs}
function emptySession(tab,{messages='messages',draft='draft',files='files'}={}){return !(tab?.[messages]||[]).length&&!String(tab?.[draft]||'').trim()&&!(tab?.[files]||[]).length&&!tab?.progress&&!tab?.preflight&&!tab?.roundtableProgress&&!tab?.plan&&!tab?.resultPath}
function isLastEmptyTab(tabs, session, fields) {
  return tabs.filter(tab => !tab.archived).length === 1 && emptySession(session, fields);
}
function retainScroll(view,list,id){view.chatScrollStates??={};const state=view.chatScrollStates[id]||{top:0,follow:true};let touched=false;list.addEventListener('scroll',()=>{if(!list.isConnected)return;touched=true;view.chatScrollStates[id]={top:list.scrollTop,follow:list.scrollHeight-list.scrollTop-list.clientHeight<50}},{passive:true});const restore=()=>{if(!list.isConnected||touched)return;list.scrollTop=state.follow?list.scrollHeight:state.top};restore();if(typeof requestAnimationFrame==='function')requestAnimationFrame(restore)}
function createChatLayout(view, root, title, modeClass) {
  root.addClass('ws-chat-layout');
  if (modeClass) root.addClass(modeClass);
  const header = renderChatHeader(root, title);
  let messageList;
  let sessionId;

  return {
    header,
    messages(id, extraClass) {
      sessionId = id;
      messageList = root.createDiv({cls: 'ws-chat'});
      if (extraClass) messageList.addClass(extraClass);
      return messageList;
    },
    portraits(people, {lineup = false, identity} = {}) {
      if (!people.length && !identity) return;
      const area = root.createDiv({cls: 'ws-chat-portrait-area'});
      if (people.length) {
        messageList.addClass('ws-chat-with-portraits');
        const group = area.createDiv({cls: 'ws-roundtable-portraits'});
        if (lineup) group.addClass('is-lineup');
        const gap = people.length > 1
          ? Math.max(0, Math.min(45, ((root.clientWidth || 360) - 145) / (people.length - 1)))
          : 0;
        people.forEach(({name, src}, index) => {
          const item = group.createDiv({cls: 'ws-roundtable-portrait-item', attr: {title: name, 'aria-label': name}});
          item.style.setProperty('--portrait-offset', (index * gap) + 'px');
          item.style.zIndex = String(people.length - index);
          if (src) item.createEl('img', {cls: 'ws-roundtable-portrait-image', attr: {src, alt: name}});
          else item.createDiv({cls: 'ws-roundtable-portrait-placeholder', text: (name || '?').slice(0, 1).toUpperCase()});
        });
      }
      if (identity) {
        area.addClass('ws-chat-portrait-area-with-identity');
        const label = area.createDiv({cls: 'ws-character-chat-identity'});
        label.createEl('strong', {text: identity.name});
        if (identity.description) label.createEl('span', {text: identity.description, cls: 'ws-hint'});
      }
    },
    composer(inputAttrs, actionsClass) {
      const compose = root.createDiv({cls: 'ws-compose'});
      const input = compose.createEl('textarea', {cls: 'ws-chat-input', attr: inputAttrs});
      const preview = compose.createDiv({cls: 'ws-chat-context-preview'});
      const actions = compose.createDiv({cls: 'ws-compose-bottom'});
      if (actionsClass) actions.addClass(actionsClass);
      retainScroll(view, messageList, sessionId);
      return {compose, input, preview, actions};
    }
  };
}

function renderCollectorModes(root, session, disabled, save) {
  const controls = root.createDiv({cls: 'ws-collector-mode-controls'});
  const buttons = [];
  const modes = [
    ['all', '1', 'Все файлы сразу'],
    ['files', '2', 'Файлы по очереди'],
    ['batch', '3', 'Группы файлов']
  ];
  for (const [value, number, label] of modes) {
    const button = controls.createEl('button', {
      cls: 'ws-collector-mode-choice mode-' + value,
      attr: {title: label, 'aria-label': label}
    });
    button.createSpan({text: number, cls: 'ws-collector-mode-number'});
    button.createSpan({text: label, cls: 'ws-collector-mode-label', attr: {'aria-hidden': 'true'}});
    button.disabled = disabled;
    button.onclick = () => {
      session.mode = value;
      update();
      save();
    };
    buttons.push({button, value});
  }
  const batch = controls.createDiv({cls: 'ws-collector-batch-controls'});
  const fewer = batch.createEl('button', {text: '−', attr: {'aria-label': 'Меньше файлов в группе'}});
  const count = batch.createSpan({cls: 'ws-collector-batch-count', attr: {title: 'Файлов в группе'}});
  const more = batch.createEl('button', {text: '+', attr: {'aria-label': 'Больше файлов в группе'}});
  session.batchSize = Math.max(2, Math.min(100, Number(session.batchSize) || 3));
  fewer.onclick = () => { session.batchSize--; update(); save(); };
  more.onclick = () => { session.batchSize++; update(); save(); };

  function update() {
    const selectedMode = session.mode || 'all';
    for (const {button, value} of buttons) {
      const selected = value === selectedMode;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    const active = selectedMode === 'batch';
    batch.classList.toggle('is-visible', active);
    batch.setAttribute('aria-hidden', String(!active));
    count.setText(String(session.batchSize));
    fewer.disabled = disabled || !active || session.batchSize <= 2;
    more.disabled = disabled || !active || session.batchSize >= 100;
  }
  update();
}

function renderCollectorWelcome(list, {description, onExample, examples: customExamples}) {
  const empty = list.createDiv({cls: 'ws-chat-empty ws-collector-empty'});
  empty.createEl('strong', {text: 'Соберите сведения из заметок и глав'});
  empty.createEl('p', {text: description});
  empty.createEl('span', {text: 'Например:', cls: 'ws-hint'});
  const examples = customExamples || [
    ['Предметы героя', 'Собери сведения о предметах, которые герой создал, нашёл или носил с собой.'],
    ['Биография персонажа', 'Собери все сведения о персонаже и составь его биографию: происхождение, важные события, отношения, навыки и изменения со временем.'],
    ['Правила мира', 'Собери описанные в источниках правила мира, магии или игровой системы, сохранив ограничения и разные варианты.'],
    ['События глав', 'Собери основные события выбранных глав в порядке их появления.']
  ];
  const buttons = empty.createDiv({cls: 'ws-collector-examples'});
  for (const [label, task] of examples) {
    const button = buttons.createEl('button', {text: label, cls: 'ws-action-quiet'});
    button.onclick = () => onExample(task);
  }
  empty.createDiv({cls: 'ws-collector-completion', text: 'Результат сохранится в один файл.'});
}

function renderCollectorCompletion(list, workspace, text, resultPath) {
  const marker = list.createDiv({cls: 'ws-collector-completion'});
  marker.createSpan({text});
  if (!resultPath) return;
  marker.createEl('hr', {cls: 'ws-collector-completion-divider'});
  const open = marker.createEl('button', {text: 'Открыть файл', cls: 'ws-collector-completion-open'});
  open.onclick = () => workspace.openLinkText(resultPath, '', true);
}

module.exports={createChatLayout,renderTabs,renderChatLoad,renderCollectorCompletion,renderCollectorWelcome,renderCollectorModes,isLastEmptyTab,emptySession};
