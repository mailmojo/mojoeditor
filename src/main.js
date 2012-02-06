require.config({
	paths: {}
});

define(['editor'], function (Editor) {
	var global = this;
	global.MojoEditor = Editor;
});
