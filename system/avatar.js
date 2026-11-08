// Адрес изображения внутри хранилища для протокола ресурсов Obsidian.
const path = require('path');
function avatarImage(app, plugin) {
  const adapter = app.vault.adapter;
  const base = adapter.getBasePath();
  const image = path.join(plugin.writerStudioRoot, 'images', 'avatar.jpg');
  const relative = path.relative(base, image).split(path.sep).join('/');
  return adapter.getResourcePath(relative);
}
module.exports = avatarImage;
