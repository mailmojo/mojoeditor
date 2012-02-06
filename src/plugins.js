define(['plugins/dynamic_content', 'plugins/editables', 'plugins/snippets',
	   'plugins/links', 'plugins/images'],
	function (dynamicContent, editables, snippets, links, images) {
		return [
			dynamicContent, editables, snippets, links, images
		];
	}
);
