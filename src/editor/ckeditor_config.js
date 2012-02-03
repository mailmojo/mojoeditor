/**
 * WYSIWYG editor settings.
 * @see http://docs.cksource.com/ckeditor_api/symbols/CKEDITOR.config.html
 * @var Object
 */
define({
	language: 'no',

	/*
	 * When copying from other sources and pasting it inside the CKEditor, the text will have
	 * all its formats removed.
	 */
	forcePasteAsPlainText: true,

	/*
	 * List of plugins we don't need loaded by CKEditor.
	 * Default plugins:
	 *   about, basicstyles, blockquote, button, clipboard, colorbutton, colordialog,
	 *   contextmenu, div, elementspath, enterkey, entities, filebrowser, find, flash, font,
	 *   format, forms, horizontalrule, htmldataprocessor, image, indent, justify, keystrokes,
	 *   link, list, maximize, newpage, pagebreak, pastefromword, pastetext, popup, preview,
	 *   print, removeformat, resize, save, scayt, smiley, showblocks, showborders, sourcearea,
	 *   stylescombo, table, tabletools, specialchar, tab, templates, toolbar, undo,
	 *   wysiwygarea, wsc
	 */
	removePlugins: 'about,elementspath,flash,font,forms,newpage,pagebreak,preview,' +
			'print,save,scayt,smiley,showblocks,sourcearea,wsc',

	/*
	 * Name of default toolbar configuration, where toolbar contents are defined
	 * in toolbar_<name> config setting.
	 * @see http://docs.cksource.com/ckeditor_api/symbols/CKEDITOR.config.html#.toolbar_Full
	 */
	toolbar: 'Content',

	toolbar_Inline: [
		['Cut', 'Copy', 'Paste', '-', 'Undo', 'Redo', '-', 'Find', 'Replace'],
		['Bold', 'Italic', '-', 'TextColor', 'BGColor', '-', 'Link', 'Unlink', '-', 'Image']
	],

	/*
	 * Toolbar configuration for editing <mm:content>. Enables adding block elements
	 * like headers and lists as well.
	 */
	toolbar_Content: [
		['Cut', 'Copy', 'Paste', '-', 'Undo', 'Redo', '-', 'Find', 'Replace',
			'-', 'Link', 'Unlink', '-', 'Image', 'Table', 'HorizontalRule'],
		['Format', '-', 'Bold', 'Italic', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock',
			'-', 'NumberedList', 'BulletedList', 'Outdent', 'Indent', '-', 'TextColor', 'BGColor']
	],

	// List of tags to enable in 'Format' drop down
	format_tags: 'p;h1;h2;h3;h4;h5;h6;pre',

	/*
	 * TODO: Backend action returning a CSS file based on <style> elements in template.
	 * This would enable the most correct CSS/styling of content in the WYSIWYG editor.
	 */
	//contentsCss: '/templates/<tid>/css',

	// Disable width resizing by keeping it to a fixed width
	resize_minWidth: 600,
	resize_maxWidth: 600,
	resize_minHeight: 100,
	resize_maxHeight: 380,

	// URL to action for uploading images
	filebrowserImageUploadUrl: '/mailings/' + '91201' + '/images/upload',

	// Avoid loading separate config.js
	customConfig: ''
});
