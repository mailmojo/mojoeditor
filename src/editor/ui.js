define(function () {
	var exports = {};

	exports.init = function (editor) {
		var ui = {},
			rootUrl = editor.opts.root,
			$ = editor.window.jQuery;

		ui.buttons = {
			edit: $('<span class="mm-edit" />').append(
				'<img src="' + rootUrl + 'img/edit.png" alt="Rediger" />'),
			add: $('<div class="mm-add" />').append(
				'<button type="button" class="add">Legg til ny</button>'),
			remove: $('<span class="mm-remove" />').append(
				'<img src="' + rootUrl + 'img/delete.png" alt="Slett" />')
		};

		ui.overlay = $('<div class="mm-overlay" />')
			.css({
				position: 'fixed',
				top: 0,
				left: 0,
				width: '100%',
				// TODO: Size dynamically
				height: '100%',
				backgroundColor: '#ffffff',
				opacity: 0.5,
				zIndex: 900  // The editor panel has a z-index of 1000
			})
			.bind('mousedown selectstart', function (e) {
				e.preventDefault();
				return false;
			});

		return ui;
	};

	return exports;
});
