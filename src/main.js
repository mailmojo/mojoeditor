require.config({
	paths: {}
});

define(['editor'], function (Editor) {
	var global = this;

	global.MailMojo = global.MailMojo || {};
	global.MailMojo.ContentEditor = Editor;
});
