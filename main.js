// Загрузчик исходных модулей Writer Studio для настольного Obsidian.
const { Plugin, Notice } = require('obsidian');
const fs = require('fs');
const path = require('path');

function loadWriterModules(root) {
  const cache = new Map();
  function load(filename) {
    let file = path.resolve(filename);
    if (!path.extname(file)) file += '.js';
    const relative = path.relative(root, file);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
      throw new Error('Модуль находится за пределами папки плагина');
    }
    if (cache.has(file)) return cache.get(file).exports;
    const source = fs.readFileSync(file, 'utf8');
    const module = { exports: {}, filename: file };
    cache.set(file, module);
    const localRequire = name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name);
    try {
      const run = new Function('require', 'module', 'exports', '__filename', '__dirname', source + '\n//# sourceURL=' + file.replace(/\s/g, '%20').replace(/\\/g, '/'));
      run(localRequire, module, module.exports, file, path.dirname(file));
    } catch (error) {
      cache.delete(file);
      throw error;
    }
    return module.exports;
  }
  return load(path.join(root, 'main.src.js'));
}

module.exports = class WriterStudioLoader extends Plugin {
  async onload() {
    try {
      const base = this.app.vault.adapter.getBasePath();
      const pluginsDir = path.resolve(base, this.app.vault.configDir || '.obsidian', 'plugins');
      const manifestDir = this.manifest.dir || this.app.plugins?.manifests?.[this.manifest.id]?.dir;
      const candidates = [manifestDir && path.resolve(base, manifestDir), path.join(pluginsDir, this.manifest.id), path.join(pluginsDir, 'writer-studio')].filter(Boolean);
      const matches = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).id === this.manifest.id && fs.existsSync(path.join(dir, 'main.src.js')); } catch (_) { return false; } };
      let root = candidates.find(matches);
      if (!root) root = fs.readdirSync(pluginsDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => path.join(pluginsDir, entry.name)).find(matches);
      if (!root) throw new Error('Не найдена папка модулей Writer Studio');
      this.writerStudioRoot = root;
      const Implementation = loadWriterModules(root);
      if (typeof Implementation !== 'function') throw new Error('Модуль приложения не экспортирует класс плагина');
      const descriptors = Object.getOwnPropertyDescriptors(Implementation.prototype);
      delete descriptors.constructor;
      delete descriptors.onload;
      delete descriptors.onunload;
      Object.defineProperties(this, descriptors);
      this.writerStudioUnload = Implementation.prototype.onunload;
      await Implementation.prototype.onload.call(this);
    } catch (error) {
      console.error('Writer Studio: не удалось загрузить модули', error);
      new Notice('Writer Studio: ошибка загрузки модулей. Проверьте файлы плагина и консоль Obsidian.', 10000);
      throw error;
    }
  }
  onunload() {
    this.writerStudioUnload?.call(this);
    this.writerStudioUnload = null;
  }
};
