(function () {
/**
 * almond 0.0.3 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
/*jslint strict: false, plusplus: false */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {

    var defined = {},
        waiting = {},
        aps = [].slice,
        main, req;

    if (typeof define === "function") {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseName = baseName.split("/");
                baseName = baseName.slice(0, baseName.length - 1);

                name = baseName.concat(name.split("/"));

                //start trimDots
                var i, part;
                for (i = 0; (part = name[i]); i++) {
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }
        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (waiting.hasOwnProperty(name)) {
            var args = waiting[name];
            delete waiting[name];
            main.apply(undef, args);
        }
        return defined[name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    function makeMap(name, relName) {
        var prefix, plugin,
            index = name.indexOf('!');

        if (index !== -1) {
            prefix = normalize(name.slice(0, index), relName);
            name = name.slice(index + 1);
            plugin = callDep(prefix);

            //Normalize according
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            p: plugin
        };
    }

    main = function (name, deps, callback, relName) {
        var args = [],
            usingExports,
            cjsModule, depName, i, ret, map;

        //Use name if no relName
        if (!relName) {
            relName = name;
        }

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Default to require, exports, module if no deps if
            //the factory arg has any arguments specified.
            if (!deps.length && callback.length) {
                deps = ['require', 'exports', 'module'];
            }

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            for (i = 0; i < deps.length; i++) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = makeRequire(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = defined[name] = {};
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = {
                        id: name,
                        uri: '',
                        exports: defined[name]
                    };
                } else if (defined.hasOwnProperty(depName) || waiting.hasOwnProperty(depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw name + ' missing ' + depName;
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef) {
                    defined[name] = cjsModule.exports;
                } else if (!usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = req = function (deps, callback, relName, forceSync) {
        if (typeof deps === "string") {

            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            //Drop the config stuff on the ground.
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = arguments[2];
            } else {
                deps = [];
            }
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function () {
        return req;
    };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (define.unordered) {
            waiting[name] = [name, deps, callback];
        } else {
            main(name, deps, callback);
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("lib/requirejs/almond", function(){});

/**
 * WYSIWYG editor settings.
 * @see http://docs.cksource.com/ckeditor_api/symbols/CKEDITOR.config.html
 * @var Object
 */
define('editor/ckeditor_config',{
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

	// Avoid loading separate config.js
	customConfig: ''
});

define('locales',{
	'no': {
		'days_short': ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'],
		'days_long': ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'],
		'months_short': ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul',
				'aug', 'sep', 'okt', 'nov', 'des'],
		'months_long': ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli',
				'august', 'september', 'oktober', 'november', 'desember'],
		'format' : '%d/%m/%Y'
	},
	'sv': {
		'days_short': ['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör'],
		'days_long': ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'],
		'months_short': ['jan', 'febr', 'mars', 'apr', 'maj', 'juni', 'juli',
				'aug', 'sept', 'okt', 'nov', 'dec'],
		'months_long': ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli',
				'augusti', 'september', 'oktober', 'november', 'december'],
		'format' : '%d/%m/%Y'
	},
	'da': {
		'days_short': ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'],
		'days_long': ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'],
		'months_short': ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul',
				'aug', 'sep', 'okt', 'nov', 'dec'],
		'months_long': ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli',
				'august', 'september', 'oktober', 'november', 'december'],
		'format' : '%d/%m/%Y'
	},
	'en': {
		'days_short': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
		'days_long': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		'months_short': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
				'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		'months_long': ['January', 'February', 'March', 'April', 'May', 'June', 'July',
				'August', 'September', 'October', 'November', 'December'],
		'format': '%m/%d/%Y'
	}
});

define('plugins/editables',[],function () {
	var jQuery, EditablesManager,
		/**
		 * List of editable elements which supports block editing.
		 * Internet Explorer does not support namespaces, so match without namespace for it.
		 * @var Array
		 */
		BLOCK_ELEMENTS = ['mm:content']; //$.support.namespaces ? ['mm:content'] : ['content'],

	/**
	 * Determines if an element is one of the block editable elements.
	 *
	 * @param HTMLElement | jQuery The element or jQuery selection to test.
	 * @return Boolean
	 */
	function isBlockElement (element) {
		if (typeof element.jquery !== 'undefined') {
			element = element[0];
		}
		return (jQuery.inArray(element.nodeName.toLowerCase(), BLOCK_ELEMENTS) !== -1);
	}

	EditablesManager = function (editor) {
		this.editor = editor;

		jQuery(EditablesManager.SELECTOR)
			.append(editor.ui.buttons.edit.clone())
			.find('span.mm-edit')
				.click(jQuery.proxy(this.edit, this));
	};

	EditablesManager.SELECTOR = "h1[editable], h2[editable], h3[editable], " +
			"h4[editable], h5[editable], h6[editable], td[editable], p[editable], span[editable], " +
			"mm\\:content, content";

	/**
	 * Initializes editing of an element's content in a WYSIWYG editor.
	 *
	 * @param Event e
	 */
	EditablesManager.prototype.edit = function (e) {
		var
			$button = jQuery(e.target).closest('.mm-edit'),
			$container = $button.parent(),
			type = isBlockElement($container) ? 'Block' : 'Inline';
		// Adds an overlay to the background
		this.editor.toggleOverlay(true);

		// Makes it impossible to open a new dialog, when a dialog is already open.
		if (this.editor.getCurrentEditorPane() !== null) {
			return false;
		}

		// Remove edit button from the content to be edited
		$button.remove();

		var resetter = jQuery.proxy(function (editor, pane) {
			var $newButton = editor.ui.buttons.edit.clone();
			editor.toggleOverlay(false);
			$container.append($newButton.click(jQuery.proxy(this.edit, this)));
		}, this);
		
		// Get a reference for an appropriate editor pane and display it
		this.editor
			.getEditorPane(type, {
				handleSave: resetter,
				handleCancel: resetter
			})
			.setElement($container).show();
	}

	return {
		register: function (editor) {
			jQuery = editor.window.jQuery;
			new EditablesManager(editor);
		}
	};
});

define('plugins/snippets',[],function () {
	var $, SnippetsManager;

	SnippetsManager = function (editor) {
		var remover = $.proxy(this.remove, this),
			duplicater = $.proxy(this.duplicate, this);

		this.editor = editor;

		$('mm\\:snippet, snippet')
			.each(function () {
				var $this = $(this),
					$prev = $this.prev(),
					isSingle = !$this.hasClass('mm-duplicated') && !$prev.hasClass('mm-duplicated');

				$this.append(editor.ui.buttons.remove.clone())
					.find('span.mm-remove')
						.css('display', isSingle ? 'none' : '')
						.click(remover);
			})
			.filter(':not(.mm-duplicated)')
				.append(editor.ui.buttons.add)
					.find('button.add')
						.click(duplicater);
	};

	/**
	 * Performs a duplication of an mm:snippet element with it's HTML content, while keeping
	 * the GUI for further duplication to the last mm:snippet among it's siblings.
	 *
	 * @param Event e
	 */
	SnippetsManager.prototype.duplicate = function (e) {
		var $snippet = $(e.target).parent().parent(),
			$clone = null;

		// If a dialog is open, clicking on the snippet-duplicate button won't trigger anything.
		if (this.editor.getCurrentEditorPane() !== null) {
			return false;
		}

		// Make sure removal button is shown before duplicating
		$snippet.find('span.mm-remove').show();
		$clone = $snippet.clone(true);

		$snippet
			// Mark as cloned to prevent add button being appended to the snippet again
			.addClass('mm-duplicated')
			// Remove current add button from snippet
			.find('div.mm-add')
				.remove()
				.end()
			// Add cloned snippet with add button as the next sibling
			.after($clone);

		this.editor.trigger('contentchanged.editor');
	}

	/**
	 * Removes a mm:snippet element and updates the sibling snippets. It also hides the
	 * removal button if there's only one snippet left of the same kind, to prevent every
	 * mm:snippet from being removed.
	 *
	 * @param Event e
	 */
	SnippetsManager.prototype.remove = function (e) {
		var
			// Actual mm:snippet element
			$snippet = $(e.target).closest('.mm-remove').parent(),
			// Previous mm:snippet element, if any
			$previous = $snippet.prev(),
			// Has current snippet been duplicated to create a new snippet?
			isDuplicated = $snippet.hasClass('mm-duplicated'),
			shouldRemove = false;

		// If a dialog is open, clicking on the snippet-remove button won't trigger anything.
		if (this.editor.getCurrentEditorPane() !== null) {
			return false;
		}

		// Duplicated snippets are never the last one, always remove
		if (isDuplicated) {
			shouldRemove = true;
		}
		/*
		 * Non-duplicated snippets must have a duplicated snippet as it's previous
		 * sibling (meaning it's not the only one left) to be removed, and needs to have
		 * it's duplicate GUI moved to previous snippet first.
		 */
		else if ($previous.hasClass('mm-duplicated')) {
			$previous.append($snippet.find('div.mm-add')).removeClass('mm-duplicated');
			shouldRemove = true;
		}

		if (shouldRemove === true) {
			var $next = $snippet.next();

			/*
			 * If snippet is duplicated, there's no previous duplicated snippet sibling
			 * and the next snippet is the last one (not duplicated) we need to hide the
			 * removal button of the next snippet.
			 */
			if (isDuplicated &&
					!$previous.hasClass('mm-duplicated') &&
					!$next.hasClass('mm-duplicated')) {
				$next.find('span.mm-remove').hide();
			}
			/*
			 * If snippet to remove is not a duplicated snippet, and neither of it's two
			 * previous siblings are duplicated snippets it means the immediate previous sibling
			 * will be the last snippet of this kind, and should thus have no removal button.
			 */
			else if (!isDuplicated &&
					 !$previous.hasClass('mm-duplicated') &&
					 !$previous.prev().hasClass('mm-duplicated')) {
				$previous.find('span.mm-remove').hide();
			}

			$snippet.remove();
			this.editor.trigger('contentchanged.editor');
		}
	}

	return {
		register: function (editor) {
			$ = editor.window.jQuery;
			new SnippetsManager(editor);
		}
	};
});

define('util/dom',[],function () {

	/**
	 * Custom ImportNode for Internet Explorer
	 * http://www.alistapart.com/articles/crossbrowserscripting/
	 *
	 * TODO: Maybe move these function into a seperate js file and wrap the
	 *       two global function into a static object wrapper.
	 *
	 * @param Node node            Node to import
	 * @param Boolean allChildren  Include all children
	 * @return Node
	 */
	function customImportNode (node, allChildren) {
		// Find the node type to import
		switch (node.nodeType) {
			case this.ELEMENT_NODE:
				// Create a new element
				var newNode = this.createElement(node.nodeName);
				// Does the node have any attributes to add?
				if (node.attributes && node.attributes.length > 0) {
					var nodeName, nodeValue;
					for (var i = 0; i < node.attributes.length; i++) {
						nodeName = node.attributes[i].nodeName;
						nodeValue = node.attributes[i].nodeValue;
						/*
						 * Might be some conflicts with jQuery unique id attribute
						 * so we might as well remove it.
						 */
						if (!nodeName.match(/^(aria|jquery|complete|loop)/i) &&
								nodeName != 'implementation') {
							if (nodeValue && nodeValue != "null") {
								newNode.setAttribute(nodeName, nodeValue);
							}
						}
					}

					/*
					 * IE doesn't copy over the style attribute so we do this after the
					 * attributes copying
					 */
					if (node.style && node.style.cssText) {
						newNode.style.cssText = node.style.cssText;
					}
				}
				// Are we going after children too, and does the node have any?
				if (allChildren && node.childNodes && node.childNodes.length > 0)
					// Recursively get all of the child nodes
					for (var i = 0; i < node.childNodes.length; i++) {
						newNode.appendChild(this.importNode(node.childNodes[i], allChildren));
					}
				return newNode;
				break;
			case this.TEXT_NODE:
			case this.CDATA_SECTION_NODE:
			case this.COMMENT_NODE:
				return this.createTextNode(node.nodeValue);
				break;
		}
	}

	return {
		/**
		 * Creates properties needed for the custom importNode function and
		 * adds the customImportNode function to importNode.
		 *
		 * @param Document doc
		 */
		assignCustomImportNode: function (doc) {
			if (!doc.ELEMENT_NODE) {
				doc.ELEMENT_NODE = 1;
				doc.ATTRIBUTE_NODE = 2;
				doc.TEXT_NODE = 3;
				doc.CDATA_SECTION_NODE = 4;
				doc.ENTITY_REFERENCE_NODE = 5;
				doc.ENTITY_NODE = 6;
				doc.PROCESSING_INSTRUCTION_NODE = 7;
				doc.COMMENT_NODE = 8;
				doc.DOCUMENT_NODE = 9;
				doc.DOCUMENT_TYPE_NODE = 10;
				doc.DOCUMENT_FRAGMENT_NODE = 11;
				doc.NOTATION_NODE = 12;
			}
			doc.importNode = customImportNode;
		},

		/**
		 * Compatibility wrapper for avoiding NULL values for attribute being inserted as the string
		 * value 'null', and to simply remove attributes with an empty string value.
		 *
		 * @param HTMLElement el The element to update attributes for.
		 * @param String name    The name of the attribute.
		 * @param String value   The value of the attribute, if any.
		 */
		updateAttribute: function (el, name, value) {
			if (value && value !== "") {
				//$(el).attr(name, value);
				el.setAttribute(name, value);
			}
			else {
				// IE7 does not support removal of class attribute, so empty string as fallback
				if (name == 'class') {
					el.className = '';
				}
				el.removeAttribute(name);
			}
		},

		/**
		 * Compatibility wrapper for checking if an element has a specific attribute set.
		 * Internet Explorer does not support the DOM method Node.hasAttribute, so we check the
		 * raw HTML string provided by outerHTML.
		 *
		 * TODO: Improve with support for non-empty elements in IE with outerHTML. Currently
		 * assumes outerHTML only returns HTML for the specific element, meaning it has to be
		 * an empty element like 'img'.
		 *
		 * @param HTMLElement el The element to check for the existence of an attribute.
		 * @param String name    The name of the attribute to check for.
		 * @return Boolean Whether or not the element has the specified attribute set.
		 */
		hasAttribute: function (el, name) {
			if (typeof el.hasAttribute === 'function') {
				return el.hasAttribute(name);
			}
			else if (typeof el.outerHTML !== 'undefined') {
				return !!el.outerHTML.match(new RegExp(name + '=', 'i'));
			}
			return (typeof el[name] !== 'undefined');
		}
	};
});

/**
 * Encapsulation of static interface/factory and class for EditorPane objects which manages
 * panes with WYSIWYG editors that can have different configurations (i.e. toolbars).
 */
define('editor/pane',['./ckeditor_config', '../util/dom'], function (editorConfig, dom) {

	function init (window) {
		var
			CKEDITOR = window.CKEDITOR,
			document = window.document,
			$ = window.jQuery,
			/**
			 * Cache of different editor pane types for reuse.
			 * @var Object
			 */
			instances = {},
			/**
			 * Reference to currently open editor pane.
			 * @var EditorPane
			 */
			current = null,
			/**
			 * Global editor pane mode. Currently only 'single' is supported, meaning only
			 * one editor pane will be shown. Any open editor pane will be closed when another
			 * is shown.
			 * @var String
			 */
			mode = 'single',
			/**
			 * Configuration extensions/overrides for specific editor pane types.
			 * @var Object
			 */
			configs = {
				'Block': {
					toolbar: 'Content',
					enterMode: CKEDITOR.ENTER_P,
					height: '380px'
				},
				'Inline': {
					toolbar: 'Inline',
					enterMode: CKEDITOR.ENTER_BR,
					shiftEnterMode: CKEDITOR.ENTER_BR,
					height: '350px',
					// Removes the 'Lorem ipsum...' text from img preview box
					image_previewText: '&nbsp;'
				}
			};

		/**
		 * Handles every getData call to a CKEditor instance for fetching the current data, and
		 * enables filtering the HTML it returns.
		 * Currently it is very simple and only normalizes output from editors for inline content,
		 * avoiding a wrapping <p> element for inline editables (<p editable>, <span editable> etc).
		 * in Internet Explorer. Wrapping inline content in a <p> causes problems when injected into
		 * editable <p> elements, where Explorer will subsequently unwrap the inner <p> into it's own
		 * following <p>, rendering the editable <p> empty.
		 *
		 * When/if a lot more filters are necessary or useful this should be extracted to a
		 * separate filtering object.
		 *
		 * @param CKEditor.event e The event describing the getData call, containing which editor
		 *                         it relates to and the current data value.
		 */
		function filterEditorData (e) {
			var
				editor = e.editor,
				data = e.data;

			if (editor.config.enterMode == CKEDITOR.ENTER_BR) {
				data.dataValue = data.dataValue.replace(/^\s*<p>\s*([\s\S]+?)\s*<\/p>\s*$/i, '$1');
			}
		}

		/*
		 * Hides unnecessary contents from the content editor dialogs.
		 *
		 * All these id's are located in /js/lib/ckeditor/<plugin>/dialogs/<something>.js
		 * and must be digged out from wihtin that GUI js file.
		 * Look for signs like: {id:'cmbAlign',type: ....  where cmbAlign is the name of the
		 * property you are after.
		 */
		CKEDITOR.on('dialogDefinition', function (e) {
			var dialogName = e.data.name,
				dialogDefinition = e.data.definition,
				infoTab;

			if (dialogName == 'link') {
				dialogDefinition.removeContents('target');
				// Get a reference to the 'Advanced' tab.
				var advancedTab = dialogDefinition.getContents('advanced');
				$.each(['advId', 'advAccessKey', 'advTabIndex',
						'advName', 'advLangDir', 'advLangCode',
						'advCharset', 'advContentType'],
						function (i, field) {
					advancedTab.remove(field);
				});
			}
			else if (dialogName == 'image') {
				// Get a reference to the 'Info' tab.
				infoTab = dialogDefinition.getContents('info');
				infoTab.remove('txtBorder');
				infoTab.remove('txtHSpace');
				infoTab.remove('txtVSpace');
			}
			else if (dialogName == 'table') {
				// Table plugin has an invisible "tab" called info.
				infoTab = dialogDefinition.getContents('info');
				infoTab.remove('cmbAlign');
			}
		});

		/**
		 * Constructor for EditorPane instances. Creates the necessary DOM nodes and initializes
		 * a CKEditor WYSIWYG editor with appropriate configurations.
		 * @private
		 */
		var EditorPane = function (type, opts) {
			var self = this,
				$pane =
					$('<div class="mm-editor" />')
						.append('<div class="mm-editor-content" />')
						.append('<button type="submit" class="save">Lagre</button>')
						.append(' eller ')
						.append('<button type="button" class="cancel">avbryt</button>')
						// Hide without setting 'display: none', see the EditorPane.hide() method
						.css({
							position: 'absolute',
							top: '0px',
							left: '-1000px',
							// TODO: Dynamic width
							width: 600,
							zIndex: 9000
						})
						.prependTo(document.body);

			opts = $.extend({}, opts);

			// Hook up any event handlers for save/cancel events
			if (typeof opts.save == 'function') {
				$pane.bind('EditorPane.save', opts.save);
			}
			if (typeof opts.cancel == 'function') {
				$pane.bind('EditorPane.cancel', opts.cancel);
			}

			this.type = type;
			this.pane = $pane[0];
			// Create and store a reference to the WYSIWYG editor for this pane
			this.editor = CKEDITOR.appendTo(
				$pane.find('div.mm-editor-content')[0],
				$.extend({}, editorConfig, configs[type], {
					// Event handlers, in the order they will be called
					on: {
						pluginsLoaded: function (e) {
							if (typeof opts.loaded == 'function') {
								opts.loaded.call(self);
							}
						},
						instanceCreated: function () { },
						instanceReady: function (e) {
							if (typeof opts.ready == 'function') {
								opts.ready.call(self);
							}
						},
						getData: filterEditorData
					}
				})
			);
			// Hook up event handler for clicks on save/cancel action buttons
			$pane.find('button').click(function (originalEvent) {
				var type = $(this).is('.save') ? 'save' : 'cancel',
					e = new $.Event('EditorPane.' + type);
	
				$pane.trigger(e, [self]);
				if (!e.isDefaultPrevented()) {
					self.hide();
				}
			});
		};

		EditorPane.prototype = {
			/**
			 * Set the editor's related element which the WYSIWYG editor's contents will be
			 * fetched from.
			 *
			 * @param HTMLElement | jQuery element The element to edit in the WYSIWYG editor.
			 * @return EditorPane Reference to this instance.
			 */
			setElement: function (element) {
				this.element = $(element);
				this.editor.setData(this.element.html());
	
				return this;
			},
			/**
			 * Returns the related element currently used in the WYSIWYG editor.
			 *
			 * @return HTMLElement
			 */
			getElement: function () {
				return (this.element && this.element[0]) || null;
			},
			/**
			 * Internal abstraction around the 'getSelectedElement' method of a dialog to fix problems
			 * with empty selections in Internet Explorer. This simply tries to get the selected element
			 * of the dialog, but if the selection is empty it creates a new selection with the first element
			 * of the specified type selected, and then returns this element.
			 *
			 * @scope CKEditor.dialog
			 */
			getSelectedElement: function (elementType) {
				var
					/**
					 * @var CKEDITOR.dom.document
					 */
					doc = this.getParentEditor().document,
					/**
					 * @var CKEDITOR.dom.selection
					 */
					selection = this.getParentEditor().getSelection(),
					/**
					 * @var CKEDITOR.dom.element
					 */
					element;

				/*
				 * This is a work around for browsers (Internet Explorer) where the selection is lost when
				 * clicking "OK" in a dialog. In these cases we simply search for the first element of the type
				 * we are interested in within the editor and create a new selection with it. Since this is within
				 * the CKEditor document this will always be the only element of the type, being the element we injected
				 * into the CKEditor document when we initialized the dialog.
				 */
				if (selection === null) {
					selection = new CKEDITOR.dom.selection(doc);
					selection.selectElement(doc.getElementsByTag(elementType).getItem(0));
				}

				/*
				 * In some cases, like with link elements, we need to fetch the selection start element to
				 * get the element properly in WebKit. But this is synonymous with getting the selected
				 * element of a single element selection and works fine in Firefox etc. as well.
				 */
				return selection.getSelectedElement() || selection.getStartElement();
			},
			/**
			 * Returns the type of this EditorPane.
			 *
			 * @return String
			 */
			getType: function () {
				return this.type;
			},
			/**
			 * Displays the editor pane, hiding any other open editor pane when in 'single' mode.
			 * Editor panes are techincally always displayed, just out of view. So to display in
			 * view we first hide it, and then slide it down in view.
			 *
			 * @return EditorPane Reference to this instance.
			 */
			show: function () {
				var self = this;


				if (mode == 'single' && current !== null) {
					if (this.type != current.getType()) {
						current.hide();
					}
				}

				adjustPosition(this.pane);

				$(this.pane).hide().css({ left: 0 }).slideDown(150, function () {
					// Expand editor to fit all text, has to be done when pane is visible
					adjustSize(self.editor);
					self.editor.focus();
					current = self;
				});
				return this;
			},
			/**
			 * Shows a dialog of the specified type in the editor, optionally with an element
			 * as the current selection for the dialog. Also takes care of loading the dialog if
			 * necessary, and a callback can be provided to be notified when the dialog has been
			 * loaded and shown.
			 *
			 * TODO: Investigate if this is easy to turn into a CKEditor plugin. Currently this
			 * method replicates most of the openDialog() method of the existing dialog plugin
			 * because it doesn't provide any means of being notified when the dialog is actually
			 * ready to use.
			 *
			 * @param String type        The name of the dialog type to show.
			 * @param DOMElement element Optional element to use as current selection in the editor.
			 * @param Function callback  Optional function to call when the dialog is shown.
			 */
			showDialog: function (type, element, callback) {
				var self = this;

				if (CKEDITOR.dialog.getCurrent() !== null) {
					return false;
				}

				// Assume callback when element is a function
				if (typeof element === 'function') {
					callback = element;
				}

				// Assume element when type is an object and use default type
				if (typeof type === 'object') {
					element = type;
					type = 'image';
				}

				/**
				 * Tries to find the first element with an editable attribute inside
				 * a source element. If the source element itself has an editable
				 * attribute the search is short circuited and the source element is
				 * returned directly. The source element is also returned if no
				 * element with an editable attribute is found.
				 *
				 * @param CKEDITOR.dom.element sourceElement The element to search within.
				 * @return CKEDITOR.dom.element
				 */
				function findEditableElement (sourceElement) {
					if (sourceElement.hasAttribute('editable')) {
						return sourceElement;
					}
	
					var children = sourceElement.getChildren(),
						child, index;
	
					for (index = 0; index < children.count(); index++) {
						child = children.getItem(index);
						if (child.hasAttribute('editable') ||
								(child = findEditableElement(child) && child.hasAttribute('editable'))) {
							return child;
						}
					}

					return sourceElement;
				}

				/**
				 * Imports an element into the CKEditor DOM document and selects it for
				 * editing by the CKEditor dialog being opened.
				 *
				 * @param HTMLElement element Element to be imported and selected.
				 */
				function selectElement (element) {
					var
						sel = null, clone = null,
						doc = this.editor.document.$,
						elementNew;

					// Give focus to the editor to make Internet Explorer properly handle new selections
					this.editor.focus();

					/*
					 * We assign the custom importNode function here if it does not
					 * exists, because CKEditor adds new document instance sometimes.
					 *
					 * TODO: Figure out a way to get the custom importNode automatically
					 *       added on every new document instance.
					 */
					if (typeof doc.importNode == 'undefined') {
						dom.assignCustomImportNode(doc);
					}
	
					clone = doc.importNode(element, true);

					// Clear the contents of the editor to avoid any leftover editables building up
					doc.body.innerHTML = '';
					// Add cloned image to the editor document and select it for editing
					doc.body.appendChild(clone);

					// For Explorer we most likely need to create a new selection
					if (null === (sel = this.editor.getSelection())) {
						sel = new CKEDITOR.dom.selection(this.editor.document);
					}

					sel.selectElement(findEditableElement(new CKEDITOR.dom.element(clone)));
				}

				/**
				 * Inject the element into the editor and select it before we even try to open the
				 * dialog. This fixes a selection bug in Internet Explorer 9 which prevented the dialog
				 * from fetching the selected element.
				 */
				if (element) {
					selectElement.call(self, element);
				}

				this.editor.openDialog(type, function (dialog) {
					if (typeof callback === 'function') {
						callback.call(self, dialog);
					}
				});
			},
			/**
			 * Hides the editor pane. This simply means sliding it up, then moving it out of view
			 * and redisplaying it there. By letting the editor pane be displayed, we fix problems
			 * with editor window height and selections (in Firefox).
			 *
			 * @return EditorPane Reference to this instance.
			 */
			hide: function () {
				var type = this.type;
				$(this.pane).slideUp(150, function () {
					$(this).css('left', '-1000px').show();
					if (current && type == current.getType()) {
						current = null;
					}
				});
				return this;
			}
		};

		/**
		 * Sticks the current editor pane's position to the top, so that scrolling will not
		 * hide the pane.
		 *
		 * @param DOMElement | jQuery pane The actual pane element to adjust position of.
		 */
		function adjustPosition (pane) {
			if (pane) {
				$(pane).css({position: 'absolute', top: 0});
			}
		}
		$(window).scroll(function () {
			adjustPosition(current && current.pane);
		});

		/**
		 * Adjusts the height of an editor to try fitting all text inside the editor area
		 * and avoid scrollbars.
		 *
		 * @param CKEditor editor The editor instance to adjust height of.
		 */
		function adjustSize (editor) {
			if (typeof editor.window == "undefined" ||
					typeof editor.window.$.document == "undefined") {
				setTimeout(function () {
					adjustSize(editor);
				}, 100);
				return;
			}

			var
				editorContainer = editor.container.$,
				editorWindow = editor.window.$,
				windowHeight = editorWindow.innerHeight || 0,
				documentHeight = editorWindow.document.height || 0,
				containerHeight = editorContainer.offsetHeight || 0,
				diff = documentHeight - windowHeight;

			if (diff > 0) {
				editor.resize(
					editorConfig.resize_maxWidth,
					Math.max(
						editorConfig.resize_minHeight,
						Math.min(containerHeight + diff, editorConfig.resize_maxHeight))
				);
			}
		}
		
		/**
		 * Static interface for editor panes. Provides public methods for creating/getting
		 * editor pane instances.
		 */
		return {
			/**
			 * Returns an EditorPane of a specific type. If a pane of this type has been created
			 * earlier, the existing instance is returned. Otherwise a new instance is created.
			 *
			 * @param String type Type of the EditorPane, currently either 'Block' or 'Inline' is
			 *                    supported.
			 * @param Object opts Extra options for the editorpane which is used when creating a
			 *                    new instance.
			 * @return EditorPane
			 */
			getInstance: function (type, opts) {
				if (instances[type]) {
					if (typeof opts.loaded == 'function') {
						opts.loaded.call(instances[type]);
					}
					if (typeof opts.ready == 'function') {
						opts.ready.call(instances[type]);
					}
				}
				else {
					instances[type] = new EditorPane(type, opts);
				}
				return instances[type];
			},
			/**
			 * Return the currently open EditorPane, if any.
			 *
			 * @return EditorPane
			 */
			getCurrent: function () {
				return current;
			},

			setEditorOption: function (name, value) {
				editorConfig[name] = value;
			}
		};
	}

	return {
		"init": init
	};
});

define('plugins/links',['../util/dom'], function (dom) {
	var $, LinksManager;

	LinksManager = function (editor) {
		this.editor = editor;

		$('a[editable]').click($.proxy(this.editLink, this));
	};

	/**
	 * Initializes editing of an editable link element. Re-uses the WYSIWYGs link dialog.
	 *
	 * @param Event e
	 */
	LinksManager.prototype.editLink = function (e) {
		var self = this,
			original = e.target,
			pane;

		e.preventDefault();
		e.stopPropagation();

		// TODO: Clean up when we don't have to manually remove edited elements from CKEditor
		function getEditedLink () {
			var
				/**
				 * @var CKEDITOR.dom.element
				 */
				link = pane.getSelectedElement.call(this, 'a');
			return link;
		}

		/**
		 * Handles OK event from a dialog, retrieving edited link and making sure the
		 * original link is updated.
		 *
		 * @scope CKEDITOR.dialog('link')
		 */
		function handleOk () {
			var link = getEditedLink.call(this);
			/*
			 * The edited element is owned by the CKEditor document, so we need to import
			 * it into our content editor document for using it further.
			 */
			self.updateLink(original, self.editor.window.document.importNode(link.$, true));
		}

		/**
		 * Handles hide event from a dialog, cleaning up our link specific listeners.
		 */
		function handleHide () {
			this.removeListener('ok', handleOk);
			this.removeListener('hide', handleHide);
		}

		// Display an image dialog within the inline editor
		pane = this.editor.getEditorPane('Inline', {
			ready: function () {
				this.showDialog('link', original, function (dialog) {
					dialog.on('ok', handleOk);
					/*
					 * Add onHide listener with priority 1, so we're called before the
					 * default handler in the link dialog. This enables us to clean up our
					 * stuff before the link dialog cleans up and removes some elements.
					 */
					dialog.on('hide', handleHide, null, null, 1);
				});
			}
		});
	};

	/**
	 * Updates an inline editable link with the new href attribute value, and title, style
	 * and class attributes in case they've been edited as well.
	 *
	 * @param DOMElement original The original link element being edited.
	 * @param DOMElement edited   The edited copy of the link element.
	 */
	LinksManager.prototype.updateLink = function (original, edited) {
		var	newHref = edited.getAttribute('data-cke-saved-href') || edited.getAttribute('href');

		original.setAttribute('href', newHref);

		dom.updateAttribute(original, 'class', edited.getAttribute('class'));
		dom.updateAttribute(original, 'title', edited.getAttribute('title'));
		// jQuery normalizes style attribute access in all browsers
		dom.updateAttribute(original, 'style', $(edited).attr('style'));

		this.editor.trigger('contentchanged.editor');
	};

	return {
		register: function (editor) {
			if (typeof $ === "undefined") {
				$ = editor.window.jQuery;
			}
			new LinksManager(editor);
		}
	};
});

define('plugins/images',['../util/dom'], function (dom) {
	var $, ImagesManager;

	ImagesManager = function (editor) {
		this.editor = editor;
		this.editIcon = $('<img src="' + editor.opts.root + 'img/edit.png" alt="Rediger" />')
				.addClass('mm-edit');

		$('img[editable]')
			.click($.proxy(this.editImage, this))
			.hover($.proxy(this.handleImageMouseOver, this),
				   $.proxy(this.handleImageMouseOut, this));
	};

	/**
	 * Initializes editing of an editable image element, optionally wrapped inside a link
	 * element. Re-uses the WYSIWYGs image dialog which supports uploading a new image as well.
	 * Also, when the editable image is wrapped inside a link element, the link URL can be
	 * edited in the 'Link' tab of the image dialog.
	 *
	 * @param Event e
	 */
	ImagesManager.prototype.editImage = function (e, image) {
		var
			self = this,
			$img = $(image || e.target),
			$parent = $img.parent(),
			isLink = $parent.is('a'),
			original = (isLink ? $parent : $img)[0],
			lockWidth = dom.hasAttribute($img[0], 'width'),
			lockHeight = dom.hasAttribute($img[0], 'height'),
			clone = null,
			pane;

		e.preventDefault();
		e.stopPropagation();

		/*
		 * For link elements containing an editable image we make a clean clone of the link
		 * element containing only the editable image inside it.
		 * This is due to a bug in Firefox and Opera where any text nodes inside the link
		 * element would create a weird DOM selection that CKEditor couldn't handle.
		 *
		 * Since we now just update the attributes that are available in the dialog for image and
		 * link, everything else like text nodes etc, will stay untouched inside the link.
		 */
		if (isLink) {
			clone = original.cloneNode(false);
			clone.appendChild(original.getElementsByTagName('img').item(0).cloneNode(false));
		}

		/**
		 * Called in the scope of an image dialog after a new image has been loaded, either
		 * through changes to the URL directly or a newly uploaded image.
		 * This will make sure the width and height set for the new image fits the requirements
		 * set in the attributes of the original content image being edited.
		 *
		 * @scope CKEditor.dialog('image')
		 */
		function checkSize (e) {
			var
				// Calculate proportion of newly loaded image in image dialog
				newImage = this.originalElement,
				newProportion = newImage.$.width / newImage.$.height,
				// Get width and height of original source image being edited
				sourceWidth = $img[0].getAttribute('width'),
				sourceHeight = $img[0].getAttribute('height'),
				// Get a reference to the width and height input fields in the image dialog
				widthField = this.getContentElement('info', 'txtWidth'),
				heightField = this.getContentElement('info', 'txtHeight');

			if (lockWidth && lockHeight) {
				// Avoid CKEditor updating width/height after we set a fixed size
				this.lockRatio = false;
				widthField.setValue(sourceWidth);
				heightField.setValue(sourceHeight);
			}
			else if (lockWidth) {
				widthField.setValue(sourceWidth);
				heightField.setValue(Math.round(sourceWidth / newProportion));
			}
			else if (lockHeight) {
				widthField.setValue(Math.round(sourceHeight * newProportion));
				heightField.setValue(sourceHeight);
			}

			/*
			 * Trigger keyup event to force update of the preview window.
			 * The event is wrapped in a CKEditor DOM event object since it might be
			 * a custom CKEditor system event (i.e. from dialog.onShow). setTimeout
			 * makes sure that we can fire the key up event when the new image has
			 * been loaded into the DOM.
			 */
			setTimeout(function () {
				widthField.getInputElement().fire('keyup', new CKEDITOR.dom.event(e));
			}, 50);
		}

		// TODO: Clean up when we don't have to manually remove edited elements from CKEditor
		function getEditedImage () {
			var
				/**
				 * @var CKEDITOR.dom.element
				 */
				image = pane.getSelectedElement.call(this, 'img'),
				/**
				 * @var CKEDITOR.dom.element
				 */
				edited = image.getParent().getName() === 'a' ? image.getParent() : image;
			return edited;
		}

		/**
		 * Handles OK event from a dialog, retrieving edited image and making sure the
		 * original image is updated.
		 *
		 * @scope CKEDITOR.dialog('image')
		 */
		function handleOk () {
			var image = getEditedImage.call(this);
			self.updateImage(original, image.$);
		}

		/**
		 * Handles show event from an image dialog, attaching a listener for changes to the
		 * image URL to restrict width/height changes when either size is locked.
		 *
		 * @scope CKEditor.dialog('image')
		 */
		function handleShow (e) {
			if (lockWidth || lockHeight) {
				// Add onLoad handler with lower priority than default, to override CKEditor
				this.originalElement.on('load', checkSize, this, null, 20);
				/*
				 * Make sure width/height fields are filled out properly in the dialog.
				 * For images with only one of the sizes set, the CKEditor image dialog will
				 * present a blank field for the missing size property. Our size check fixes this.
				 */
				checkSize.call(this, e);
			}

			/**
			 * Make sure that IE does not prepend the relative uri to the hash if the image
			 * has placeholder content.
			 */
			var src = $img[0].getAttribute('src');
			if (src.length > 1 && src.match('#$') !== null) {
				this.getContentElement('info', 'txtUrl').setValue('#');
			}

			/*
			 * Always set URL field in ckeditor dialog to the clone's href content.
			 * jQuery removes about:blank in IE7, when defined as '#' in the template.
			 */
			if (isLink) {
				this.getContentElement('Link', 'txtUrl').setValue($(clone).attr('href'));
			}
			else {
				this.hidePage('Link');
			}
			this.hidePage('advanced');
		}

		/**
		 * Handles hide event from a dialog, cleaning up our image specific listeners.
		 */
		function handleHide () {
			// Clean up event listeners
			if (lockWidth || lockHeight) {
				this.originalElement.removeListener('load', checkSize);
			}
			this.removeListener('ok', handleOk);
			this.removeListener('show', handleShow);
			this.removeListener('hide', handleHide);

			// Make sure any panels we've hidden are shown again in the dialog
			this.showPage('Link');
			this.showPage('advanced');
		}

		// Display an image dialog within the inline editor
		pane = this.editor.getEditorPane('Inline', {
			ready: function () {
				self.hideImageEditIcon();

				this.showDialog('image', clone || original, function (dialog) {
					dialog.on('ok', handleOk);
					dialog.on('show', handleShow);
					/*
					 * Add onHide listener with priority 1, so we're called before the
					 * default handler in the image dialog. This enables us to clean up our
					 * stuff before the image dialog cleans up and removes some elements.
					 */
					dialog.on('hide', handleHide, null, null, 1);
				});
			}
		});
	};

	/**
	 * Updates an editable image with an updated version from CKEditor.
	 * To ensure that the image with or without a link does not get any more attributes than
	 * those you can change in the image dialog, we manual copy them from the edited image
	 * in the image dialog, to the original image in the newsletter.
	 *
	 * @param DOMElement original The original element in the content editor.
	 * @param DOMElement edited   A copy of the original with updated attributes.
	 */
	ImagesManager.prototype.updateImage = function (original, edited) {
		var
			isLink = edited.nodeName.toLowerCase() === 'a',
			$img = isLink ? $(edited).find('img') : $(edited),
			$originalImg = isLink ? $(original).find('img') : $(original);

		this.cleanupImage($img[0], $originalImg[0]);

		if (isLink) {
			// We want to ensure that the URL is not relative to our domain
			var linkUrl = $(edited).attr('href') || '';
			if (linkUrl.length > 1 && linkUrl.substring(0, 7) != 'http://') {
				linkUrl = 'http://' + linkUrl;
			}

			// Use setAttribute since we always want the attribute to exist
			original.setAttribute('href', linkUrl);
			// Update target, possibly removing the attribute if empty
			dom.updateAttribute(original, 'target', edited.getAttribute('target'));

			// Add old-school zero border attribute for images inside links to avoid "blue link border"
			$originalImg.attr('border', '0');
		}

		/*
		 * Copy attributes from edited image to the original image
		 */
		$.each(['src', 'alt', 'width', 'height', 'align'],
			function (idx, property) {
				/*
				 * We don't want to copy over width and/or height if it's not set on the original image. IE 7
				 * has a fallback to naturalWidht/Height in that case, which we dont want to do.
				 */
				if ((property == 'width' || property == 'height') &&
						!dom.hasAttribute(original, property)) {
					return;
				}
				/*
				 * We do not use $.attr() since jQuery has fallback on width and height which is not
				 * the desired effect.
				 */
				var value =  $img[0].getAttribute(property);
				if (property == 'align' && value !== null) {
					// The only style element that is of interest. The rest is kept on the original.
					$originalImg.css('float', value);
				}
				dom.updateAttribute($originalImg[0], property, value);
			}
		);

		this.editor.trigger('contentchanged.editor');
	};

	/**
	 * Cleans up the attributes of an image, either for a specific editable image or an image
	 * inside mixed HTML content (edited through mm:content etc.).
	 * Currently we only make sure the image has width, height and align set using attributes
	 * and not only using inline styles.
	 * For editable images the width and height are only added when both are missing, otherwise
	 * the existing attribute is updated but the missing attribute is not added. This is due to
	 * our support for selective locking of either width or height on editable images.
	 *
	 * @param HTMLElement img      The edited image element to clean.
	 * @param HTMLElement original The original image that's been edited, only relevant for
	 *                             editable images.
	 */
	ImagesManager.prototype.cleanupImage = function (img, original) {
		var $img = $(img),
			width = $img.attr('width') || $img[0].naturalWidth, sWidth = parseInt($img.css('width'), 10),
			height = $img.attr('height') || $img[0].naturalHeight, sHeight = parseInt($img.css('height'), 10),
			align = $img.css('float');

		/*
		 * An original image refers to an editable image. To support selective locking of
		 * width or height we have to handle updates to these attributes differently when
		 * cleaning updated editable images.
		 */
		if (original) {
			/*
			 * If no width and height is set on the original editable image, force a fixed
			 * size to avoid bad rendering in Outlook when images are not shown.
			 */
			if (!dom.hasAttribute(original, 'width') && !dom.hasAttribute(original, 'height')) {
				img.setAttribute('width', (sWidth && sWidth > 0) ? sWidth : width);
				img.setAttribute('height', (sHeight && sHeight > 0) ? sHeight : height);
			}
			/*
			 * Otherwise when either width or height exists on the original editable image
			 * we only update the existing size attribute and remove the other size attribute
			 * from the updated image.
			 */
			else {
				if (dom.hasAttribute(original, 'width')) {
					img.setAttribute('width', (sWidth && sWidth > 0) ? sWidth : width);
				}
				else {
					img.removeAttribute('width');
					$img.css('width', '');
				}

				if (dom.hasAttribute(original, 'height')) {
					img.setAttribute('height', (sHeight && sHeight > 0) ? sHeight : height);
				}
				else {
					img.removeAttribute('height');
					$img.css('height', '');
				}
			}
		}
		/*
		 * When no original image exists we are cleaning up images from mm:content or similar
		 * mixed content. These should always have a width and height attribute set.
		 */
		else {
			/*
			 * Add missing width/height attributes and set them to the corresponding inline
			 * style value if it exists, or the actual width/height as reported by the
			 * browser as a fallback.
			 */
			if (!dom.hasAttribute(img, 'width')) {
				img.setAttribute('width', (sWidth && sWidth > 0) ? sWidth : width);
			}
			if (!dom.hasAttribute(img, 'height')) {
				img.setAttribute('height', (sHeight && sHeight > 0) ? sHeight : height);
			}
		}

		// Make sure align attribute is set if image is floated
		align = (align || '').toLowerCase();
		if (align == 'right' || align == 'left') {
			img.setAttribute('align', align);
		}
	};

	/**
	 * Makes sure an edit icon is displayed above an editable image if it currently doesn't
	 * have an edit icon.
	 *
	 * @param Event e
	 */
	ImagesManager.prototype.handleImageMouseOver = function (e) {
		if (this.editor.getCurrentEditorPane() !== null) {
			return false;
		}

		if (this.editIcon.data('relatedImage') !== e.target) {
			this.showImageEditIcon(e.target);
		}
	};

	/**
	 * Displays an edit icon in the top left corner on top of an editable image.
	 *
	 * @param DOMElement image
	 */
	ImagesManager.prototype.showImageEditIcon = function (image) {
		var
			$image = $(image),
			pos = $image.position(),
			style = {
				'left': pos.left + 4,
				'top': pos.top + 4
			};

		$image.addClass('hover');
		this.editIcon
			.data('relatedImage', image)
			.css(style)
			.insertAfter(image)
			.click($.proxy(function (e) {
				this.editImage(e, image);
				this.hideImageEditIcon();
			}, this));
	};

	/**
	 * Makes sure the edit icon above an editable image is hidden if the mouse actually
	 * moved outside the editable image. It prevents hiding of the edit icon if the mouse
	 * just moved over the edit icon itself.
	 *
	 * @param Event e
	 */
	ImagesManager.prototype.handleImageMouseOut = function (e) {
		var
			$this = $(e.target),
			$toElement = $(e.toElement),
			pos = $this.offset(),
			size = { width: $this.width(), height: $this.height() };

		// Avoid incorrectly hiding the icon if the mouse moved over the icon for this image
		if ($toElement.is('.mm-edit') && $toElement.data('relatedImage') == this) {
			return;
		}

		// Check if the mouse actually went outside the image boundaries
		if (e.clientX < pos.left || e.clientX > pos.left + size.width
				|| e.clientY < pos.top || e.clientY > pos.top + size.height) {
			this.hideImageEditIcon();
		}
	};

	/**
	 * Hides the edit icon for editable images.
	 */
	ImagesManager.prototype.hideImageEditIcon = function () {
		var $image = $(this.editIcon.data('relatedImage'));
		$image.removeClass('hover');
		this.editIcon.data('relatedImage', null).remove();
	};

	return {
		register: function (editor) {
			if (typeof $ === "undefined") {
				$ = editor.window.jQuery;
			}
			new ImagesManager(editor);
		}
	};
});

define('util/type',[],function () {
	var exports = {},
		hasOwn = Object.prototype.hasOwnProperty,
		class2type, type;

	class2type = {
		"[object Boolean]": "boolean",
		"[object Number]": "number",
		"[object String]": "string",
		"[object Function]": "function",
		"[object Array]": "array",
		"[object Date]": "date",
		"[object RegExp]": "regexp",
		"[object Object]": "object"
	};
	type = function( obj ) {
		return obj === null ?
			String( obj ) :
			class2type[ Object.prototype.toString.call(obj) ] || "object";
	};

	exports.isArray = Array.isArray || function( obj ) {
		return type(obj) === "array";
	};

	exports.isFunction = function( obj ) {
		return type(obj) === "function";
	};

	exports.isPlainObject = function( obj ) {
		// Must be an Object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window objects don't pass through, as well
		if ( !obj || type(obj) !== "object" || obj.nodeType || exports.isWindow( obj ) ) {
			return false;
		}

		try {
			// Not own constructor property must be Object
			if ( obj.constructor &&
				!hasOwn.call(obj, "constructor") &&
				!hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
				return false;
			}
		} catch ( e ) {
			// IE8,9 Will throw exceptions on certain host objects #9897
			return false;
		}

		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.

		var key;
		for ( key in obj ) {}

		return key === undefined || hasOwn.call( obj, key );
	};

	exports.isWindow = function( obj ) {
		return obj && typeof obj === "object" && "setInterval" in obj;
	};

	exports.extend = function () {
		var options, name, src, copy, copyIsArray, clone,
			target = arguments[0] || {},
			i = 1,
			length = arguments.length,
			deep = false;

		// Handle a deep copy situation
		if ( typeof target === "boolean" ) {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		}

		// Handle case when target is a string or something (possible in deep copy)
		if ( typeof target !== "object" && !exports.isFunction(target) ) {
			target = {};
		}

		for ( ; i < length; i++ ) {
			// Only deal with non-null/undefined values
			if ( (options = arguments[ i ]) != null ) {
				// Extend the base object
				for ( name in options ) {
					src = target[ name ];
					copy = options[ name ];

					// Prevent never-ending loop
					if ( target === copy ) {
						continue;
					}

					// Recurse if we're merging plain objects or arrays
					if ( deep && copy && ( exports.isPlainObject(copy) || (copyIsArray = exports.isArray(copy)) ) ) {
						if ( copyIsArray ) {
							copyIsArray = false;
							clone = src && exports.isArray(src) ? src : [];

						} else {
							clone = src && exports.isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[ name ] = exports.extend( deep, clone, copy );

					// Don't bring in undefined values
					} else if ( copy !== undefined ) {
						target[ name ] = copy;
					}
				}
			}
		}

		// Return the modified object
		return target;
	};

	return exports;
});


/*
 * datetime module.
 *
 * strftime functionality based on:
 *
 * JQuery strftime plugin
 * Version 1.0.1 (12/06/2008)
 *
 * No documentation at this point, sorry.
 *
 * Home page: http://projects.nocternity.net/jquery-strftime/
 * Examples: http://projects.nocternity.net/jquery-strftime/demo.html
 *
 * Copyright (c) 2008 Emmanuel Benoît
 * 
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

define('util/datetime',['./type'], function (type) {
	var strftime,
		_defaults, _useText, _finaliseObj, _dateTimeToDtObj, _objToDtObj;

	_defaults = {
		'days_short' : [ 'Sun', 'Mon' , 'Tue' , 'Wed' , 'Thu' ,
				'Fri' , 'Sat' ] ,
		'days_long' : [ 'Sunday' , 'Monday' , 'Tuesday' ,
				'Wednesday' , 'Thursday' , 'Friday' ,
				'Saturday' ] ,
		'months_short' : [ 'Jan' , 'Feb' , 'Mar' , 'Apr' ,
				'May' , 'Jun' , 'Jul' , 'Aug' ,
				'Sep' , 'Oct' , 'Nov' , 'Dec' ] ,
		'months_long' : [ 'January' , 'February' , 'March' ,
				'April' , 'May' , 'June' , 'July' ,
				'August' , 'September' , 'October' ,
				'November' , 'December' ] ,
		'format' : '%m/%d/%Y'
	};

	_useText = _defaults;

	_finaliseObj = function ( _obj , _month , _dow ) {
		_obj.a = _useText.days_short[ _dow ];
		_obj.A = _useText.days_long[ _dow ];
		_obj.b = _useText.months_short[ _month ];
		_obj.B = _useText.months_long[ _month ];
		_obj.m = _month + 1;

		var _tmp;

		if ( _obj.Y > 0 ) {
			_tmp = _obj.Y.toString( );
			if ( _tmp.length < 2 ) {
				_tmp = '0' + _tmp;
			} else if ( _tmp.length > 2 ) {
				_tmp = _tmp.substring( _tmp.length - 2 );
			}
			_obj.y = _tmp;
		} else {
			_obj.y = _obj.Y;
		}

		var _check = [ 'd' , 'm' , 'H' , 'M' , 'S' ];
		for ( var i in _check ) {
			_tmp = _obj[ _check[ i ] ];
			_tmp = _tmp.toString( );
			if ( _tmp.length < 2 ) {
				_tmp = '0' + _tmp;
			}
			_obj[ _check[ i ] ] = _tmp;
		}

		if (_obj.e < 10) {
			_obj.e = ' ' + _obj.e.toString();
		}

		return _obj;
	};

	_dateTimeToDtObj = function ( dateTime , utc ) {
		var _obj, _month, _dow;
		if ( utc ) {
			_obj = {
				'H' : dateTime.getUTCHours( ) ,
				'M' : dateTime.getUTCMinutes( ) ,
				'S' : dateTime.getUTCSeconds( ) ,
				'd' : dateTime.getUTCDate( ) ,
				'e' : dateTime.getUTCDate( ),
				'Y' : dateTime.getUTCFullYear( )
			};
			_month = dateTime.getUTCMonth( );
			_dow = dateTime.getUTCDay( );
		} else {
			_obj = {
				'H' : dateTime.getHours( ) ,
				'M' : dateTime.getMinutes( ) ,
				'S' : dateTime.getSeconds( ) ,
				'd' : dateTime.getDate( ) ,
				'e' : dateTime.getDate( ) ,
				'Y' : dateTime.getFullYear( )
			};
			_month = dateTime.getMonth( );
			_dow = dateTime.getDay( );
		}
		return _finaliseObj( _obj , _month , _dow );
	};

	_objToDtObj = function ( obj ) {
		var _defs = {
			'H' : 0 ,
			'M' : 0 ,
			'S' : 0 ,
			'd' : 1 ,
			'e' : 1 ,
			'Y' : 1 ,
			'm' : 1
		};
		var _dtObj = {};

		for ( var i in _defs ) {
			if ( typeof obj[ i ] != 'number' || obj[ i ] % 1 != 0 ) {
				_dtObj[ i ] = _defs[ i ];
			} else {
				_dtObj[ i ] = obj[ i ];
			}
		}

		_dtObj.m --;

		var _dow;
		if ( typeof obj.dow == 'number' && obj.dow % 1 == 0 ) {
			_dow = obj.dow;
		} else {
			_dow = 0;
		}

		return _finaliseObj( _dtObj , _dtObj.m , _dow );
	};

	strftime = function ( fmt , dateTime , utc ) {

		if ( fmt && typeof fmt == 'object' ) {
			dateTime = fmt.dateTime;
			utc = fmt.utc;
			fmt = fmt.format;
		}

		if ( !fmt || ( typeof fmt != 'string' ) ) {
			fmt = _useText.format;
		}

		var _dtObj;
		if ( dateTime && ( typeof dateTime == 'object' ) ) {
			if ( dateTime instanceof Date ) {
				_dtObj = _dateTimeToDtObj( dateTime , utc );
			} else {
				_dtObj = _objToDtObj( dateTime );
			}
		} else {
			_dtObj = _dateTimeToDtObj( new Date( ) , utc );
		}

		var _text = '' , _state = 0;
		for ( var i = 0 ; i < fmt.length ; i ++ ) {
			if ( _state == 0 ) {
				if ( fmt.charAt(i) == '%' ) {
					_state = 1;
				} else {
					_text += fmt.charAt( i );
				}
			} else {
				if ( typeof _dtObj[ fmt.charAt( i ) ] != 'undefined' ) {
					_text += _dtObj[ fmt.charAt( i ) ];
				} else {
					_text += '%';
					if ( fmt.charAt( i ) != '%' ) {
						_text += fmt.charAt( i );
					}
				}
				_state = 0;
			}
		}
		if ( _state == 1 ) {
			_text += '%';
		}

		return _text;
	};


	strftime.setText = function ( obj ) {
		if ( typeof obj != 'object' ) {
			throw new Error( 'datetime.strftime.setText() : invalid parameter' );
		}

		var _count = 0;
		for ( var i in obj ) {
			if ( typeof _defaults[ i ] == 'undefined' ) {
				throw new Error( 'datetime.strftime.setText() : invalid field "' + i + '"' );
			} else if ( i == 'format' && typeof obj[ i ] != 'string' ) {
				throw new Error( 'datetime.strftime.setText() : invalid type for the "format" field' );
			} else if ( i != 'format' && !type.isArray(obj[i]) ) {
				throw new Error( 'datetime.strftime.setText() : field "' + i + '" should be an array' );
			} else if ( obj[ i ].length != _defaults[ i ].length ) {
				throw new Error( 'datetime.strftime.setText() : field "' + i + '" has incorrect length '
						+ obj[ i ].length + ' (should be ' + _defaults[ i ].length + ')'
				       );
			}
			_count ++;
		}
		if ( _count != 5 ) {
			throw new Error( 'datetime.strftime.setText() : 5 fields expected, ' + _count + ' found' );
		}

		_useText = obj;
	};

	strftime.defaults = function ( ) {
		_useText = _defaults;
	};

	return {
		"strftime": strftime
	};
});


define('plugins/dynamic_content',['locales', 'util/datetime'], function (locales, datetime) {
	var jQuery,
		DYNAMIC_ELEMENTS = "mm\\:date, date, mm\\:from, from, mm\\:subject, subject, mm\\:share, share";

	/**
	 * Utility class for managing sharing service buttons (Facebook and Twitter so far).
	 *
	 * @param HTMLElement element The MailMojo mm:share element to create a service for.
	 * @param Boolean useCustomContent TRUE if the contents of the share element should be used,
	 *                                 FALSE if the default content should be used.
	 * @constructor
	 */
	function ShareService (element, useCustomContent) {
		var serviceName = element.getAttribute('on').toLowerCase();
		if (serviceName != 'facebook' && serviceName != 'twitter') {
			throw new Exception("Unknown share service.");
		}

		this.serviceName = serviceName;
		this.content = null;

		if (useCustomContent) {
			element.className = 'custom';
			this.content = $(element).contents().get();
		}
	}
	/**
	 * Returns a sharing service link button, either with custom content or our default
	 * content with an icon for the sharing service.
	 *
	 * @return HTMLElement
	 */
	ShareService.prototype.getButton = function () {
		var $link = jQuery('<a href="#" />');

		if (this.content !== null) {
			$link.append(this.content);
		}
		else if (this.serviceName == 'facebook') {
			$link.append('<img src="http://www.facebook.com/images/connect_favicon.png" border="0" width="14" height="14" />');
		}
		else if (this.serviceName == 'twitter') {
			$link.append('<img src="http://twitter-badges.s3.amazonaws.com/t_mini-a.png" border="0" width="16" height="16" />');
		}

		return $link[0];
	};

	/**
	 * Checks if an element contains any child nodes or text nodes containing text other than
	 * white space.
	 *
	 * @param HTMLElement element The element to check for emptyness.
	 * @return Boolean TRUE if the element has no child nodes or only contains one text node
	 *                 with only whitespace. FALSE otherwise.
	 */
	function isEmptyElement (element) {
		var nodes = element.childNodes,
			num = nodes.length;

		return (num === 0 ||
				(num == 1 && nodes[0].nodeValue && nodes[0].nodeValue.match(/^\s*$/)));
	}

	/**
	 * Adds default placeholder content while editing for elements which will be replaced by
	 * dynamic content before actually sending the mailing.
	 * It also takes care to not replace custom content in <mm:share> elements with placeholder
	 * content.
	 * Used as a callback for jQuery.fn.each.
	 *
	 * @param Number i            Index among all dynamic elements.
	 * @param HTMLElement element The dynamic element to add placeholder content for.
	 */
	function addDefaultContent (i, element) {
		// Normalize element name (without namespace) to how Explorer reports it
		var name = element.nodeName.toLowerCase().replace('mm:', ''),
			isEmpty = isEmptyElement(element),
			content = null;

		switch (name) {
			case 'share':
				try {
					content = new ShareService(element, !isEmpty).getButton();
					// This method of copying inline styles also works in IE7
					content.style.cssText = element.style.cssText;
				}
				catch (e) {}
				break;

			case 'date':
				var
					dateFormat = element.getAttribute('format'),
					lang = element.getAttribute('lang') || 'no';

				datetime.strftime.setText(locales[lang]);
				content = datetime.strftime(dateFormat);
				break;

			case 'subject':
				content = '[Emne kommer her]';
				break;

			case 'from':
				content = '[Avsendernavn kommer her]';
				break;
		}

		if (content) {
			if (typeof content === 'string') {
				content = document.createTextNode(content);
			}
			element.appendChild(content);
		}
	}

	/**
	 * Removes all default placeholder content in dynamic content elements.
	 * Used as a callback for jQuery.fn.each before returning the complete mailing content.
	 *
	 * @param Number i            Index among all dynamic elements.
	 * @param HTMLElement element The dynamic element to remove placeholder content for.
	 */
	function removeDefaultContent (i, element) {
		// Normalize element name (without namespace) to how Explorer reports it
		var name = element.nodeName.toLowerCase().replace('mm:', ''),
			$element = jQuery(element);

		switch (name) {
			case 'share':
				/*
				 * For share elements with custom content, just remove the placeholder link
				 * and leave the custom content inside the share element. Otherwise we empty
				 * the element completely as with other default content.
				 */
				if ($element.hasClass('custom')) {
					var $link = $element.children('a');

					$element.append($link.contents());
					$link.remove();
					break;
				}

			case 'date':
			case 'subject':
			case 'from':
				$element.empty();
				break;
		}
	}


	return {
		register: function (editor) {
			jQuery = editor.window.jQuery;

			jQuery(DYNAMIC_ELEMENTS).each(addDefaultContent);

			editor.on('filtercontent.editor', function (e, $content) {
				$content
					.find(DYNAMIC_ELEMENTS)
						.each(removeDefaultContent);
			});
		}
	};
});

define('plugins',['plugins/dynamic_content', 'plugins/editables', 'plugins/snippets',
	   'plugins/links', 'plugins/images'],
	function (dynamicContent, editables, snippets, links, images) {
		return [
			dynamicContent, editables, snippets, links, images
		];
	}
);

define('util/url',[],function () {
	var exports = {};

	exports.concat = function (path1, path2) {
		var l = path1.substr(-1), s = path2.substr(0, 1);
		if (l !== '/' && s !== '/') {
			return path1 + '/' + path2;
		}
		else if (l === '/' && s === '/') {
			return path1 + path2.substr(1);
		}
		return path1 + path2;
	};

	exports.basePath = function (path) {
		var lastSep = path.lastIndexOf('/');
		if (lastSep !== -1) {
			return path.substr(0, lastSep + 1);
		}
		return '';
	};

	exports.isAbsolute = function (url) {
		return url.substr(0, 3) === 'http' || url.substr(0, 1) === '/';
	};

	return exports;
});

define('editor',['editor/pane', 'plugins', 'util/dom', 'util/type', 'util/url'], function (panes, plugins, dom, type, url) {
	var editorIndex = 0;

	function convertToIframe (textarea) {
		var iframe = document.createElement('iframe'),
			iframedoc = null,
			htmlContent = textarea.value,
			// TODO: This should be supported for pre-rendered iframes too
			skypeMetaTag = '<meta name="SKYPE_TOOLBAR" content="SKYPE_TOOLBAR_PARSER_COMPATIBLE" />\n';
		
		/*
		 * Fix custom self-closing tags to HTML supported elements with separate closing tag.
		 * This is to avoid DOM related errors about non-closed non-empty elements according
		 * to the DTD, which can prevent JavaScript execution in at least WebKit (Safari/Chrome).
		 * All custom empty tags will be saved as self-closing in the template editor.
		 */
		htmlContent = htmlContent.replace(/<mm:(from|date|subject)([^>]*?)\s*\/>/gi,
				'<mm:$1$2></mm:$1>');

		/*
		 * We inject a skype meta tag here because Skype has a toolbar that injects lots
		 * of new html content and styles on different kind of phone number patterns. So
		 * we inject a meta tag for disabling this nasty feature. This meta tag is tested
		 * in IE7,8 and FF on windows and should work. We don't need to make an explicit
		 * removal of this tag, because this tag is not injected when we don't have a
		 * template, and when we have a template, the contents inside head tag is never
		 * updated with the stuff from the content editor when saved.
		 */
		htmlContent = htmlContent.replace(/<head([^>]*)>/gi, '<head$1>\n' + skypeMetaTag);

		// TODO: Improve this very simple auto-scaling
		iframe.style.width = textarea.offsetWidth + 'px';
		iframe.style.height = textarea.offsetHeight + 'px';

		textarea.style.display = 'none';
		textarea.parentNode.insertBefore(iframe, textarea);

		iframedoc = iframe.contentWindow.document;
		iframedoc.open();
		iframedoc.write(htmlContent);
		iframedoc.close();

		return iframe;
	}

	/**
	 * Creates a script element referring to an external JavaScript file, and injects it into
	 * the element specified.
	 *
	 * @param HTMLElement element Element to inject script into.
	 * @param String file         URL, relative or absolute, of JavaScript file.
	 * @param Function fn         Callback when script has loaded.
	 * @return HTMLScriptElement
	 */
	function injectJavaScript (element, file, fn) {
		var script = element.ownerDocument.createElement('script');

		script.setAttribute('type', 'text/javascript');

		if (typeof fn == 'function') {
			script.onreadystatechange = script.onload = function (e) {
				e = e || element.ownerDocument.parentWindow.event;

				/*
				 * For readystatechange events we need to check for both 'complete' and 'loaded'
				 * states. Internet Explorer may report either one of them, depending on how
				 * the file was loaded (i.e. from cache or server).
				 */
				if (e.type == 'load' ||
						(e.type == 'readystatechange' &&
							(script.readyState == 'complete' || script.readyState == 'loaded'))) {
					fn(e);
					// We don't want to trigger both onreadystatechange and onload in a browser.
					script.onreadystatechange = script.onload = null;
				}
			};
		}

		script.setAttribute('src', file);
		return element.appendChild(script);
	}

	/**
	 * Creates a link element referring to an external stylesheet file, and injects it into
	 * the element specified.
	 *
	 * @param HTMLElement element Element to inject stylesheet into.
	 * @param String file         URL, relative or absolute, of stylesheet file.
	 * @return HTMLLinkElement
	 */
	function injectStyleSheet (element, file) {
		var style = element.ownerDocument.createElement('link');

		style.setAttribute('type', 'text/css');
		style.setAttribute('rel', 'stylesheet');
		style.setAttribute('href', file);
		return element.appendChild(style);
	}

	var defaults = {
		ckeditor: 'http://static.mailmojo/js/lib/ckeditor/ckeditor.js',
		jquery: 'http://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js'
	};


	var ContentEditor = function (iframe, opts) {
		var EditorPane = null;

		this.iframe = iframe;
		this.window = iframe.contentWindow;
		this.document = iframe.contentWindow.document;
		this.opts = opts;
		this.listenerQueue = [];
		this.panes = null;
		this.ui = {};

		function loadDependencies (callback) {
			// TODO: Make sure every browser implicitly creates a head element if it's missing
			var self = this,
				header = this.document.getElementsByTagName('head').item(0),	
				numDependencies = 2;

			function onload (dependency) {
				if (--numDependencies === 0 && typeof callback === "function") {
					callback.call(self);
				}
			}

			injectStyleSheet(header, this.opts.root + 'css/editor.css');
			injectJavaScript(header, this.opts.ckeditor, onload);
			injectJavaScript(header, this.opts.jquery, onload);
		}

		function init () {
			var self = this,
				$ = this.window.jQuery;

			this.panes = panes.init(this.window);
			if (typeof opts.imageUploadUrl !== "undefined") {
				this.panes.setEditorOption("filebrowserImageUploadUrl", opts.imageUploadUrl);
			}

			// TODO: Move to separate init method or similar?
			this.ui.buttons = {
				edit: $('<span class="mm-edit" />').append(
					'<img src="' + this.opts.root + 'img/edit.png" alt="Rediger" />'),
				add: $('<div class="mm-add" />').append(
					'<button type="button" class="add">Legg til ny</button>'),
				remove: $('<span class="mm-remove" />').append(
					'<img src="' + this.opts.root + 'img/delete.png" alt="Slett" />')
			};
			this.ui.overlay = $('<div class="mm-overlay" />')
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

			/*
			 * Since internet explorer does not have an importNode function
			 * we create one for it instead.
			 */
			if (typeof this.document.importNode == 'undefined') {
				dom.assignCustomImportNode(this.document);
			}

			// Prevents the user from "leaving" the content editor.
			$('a:not([editable])').live('click', function (e) {
				e.preventDefault();
			});
			$('form').live('submit', function (e) {
				e.preventDefault();
			});

			// Register each plugin
			$.each(plugins, function (i, plugin) {
				plugin.register(self);
			});

			if (this.listenerQueue.length > 0) {
				var i = 0, len = this.listenerQueue.length;
				for ( ; i < len; i++) {
					$(this.window).on(this.listenerQueue[i].e, this.listenerQueue[i].fn);
				}
				delete this.listenerQueue;
			}

			this.trigger('initialized.editor');
		}

		loadDependencies.call(this, function () { init.call(this); });
	};

	/**
	 * Handles a save event from an EditorPane. Saves the current content in the
	 * WYSIWYG editor back into the element being edited.
	 *
	 * @param Event e
	 * @param EditorPane editorPane The pane which triggered the save event.
	 */
	ContentEditor.prototype.handleSave = function (e, editorPane) {
		this.restore(editorPane.getElement(), editorPane.editor.getData());
		this.trigger('contentchanged.editor');
	};

	/**
	 * Handles a cancel event from an EditorPane. Cancels editing by restoring current
	 * element being edited to it's original state.
	 *
	 * @param Event e
	 * @param EditorPane editorPane The pane which triggered the cancel event.
	 */
	ContentEditor.prototype.handleCancel = function (e, editorPane) {
		this.restore(editorPane.getElement());
	};

	/**
	 * Restores an element from being edited to it's normal state, optionally replacing it's
	 * contents.
	 *
	 * @param HTMLElement | jQuery element The element to restore.
	 * @param String newContent            HTML with new content, if any.
	 */
	ContentEditor.prototype.restore = function (element, newContent) {
		var $ = this.window.jQuery,
			$element = $(element);
		// Removes the dimmed overlay. XXX: Let plugins handle?
		//this.toggleOverlay(false);

		if (typeof newContent !== 'undefined') {
			$element.html(newContent);
			this.cleanup(element);
		}
	};

	/**
	 * Performs some pre-processing of the content inside an element, cleaning up attributes
	 * after being edited in CKEditor.
	 * Currently only finds and cleans all images.
	 *
	 * @param HTMLElement element The element to cleanup contents of.
	 */
	ContentEditor.prototype.cleanup = function (element) {
		var $element = this.window.jQuery(element);
		$element.find('img').each(function () {
			// TODO: Implement, should be factored out someplace...
			//cleanupImage(this);
		});
	};

	/**
	 * Displays/hides an overlay behind the editor panel after clicking on an editable element. Makes
	 * it impossible to click on other editables when having an edit panel open.
	 *
	 * @param bool enable
	 */
	ContentEditor.prototype.toggleOverlay = function (enable) {
		if (enable) {
			this.window.jQuery('body').append(this.ui.overlay);
		}
		else {
			this.ui.overlay.remove();
		}
	};

	/**
	 * Returns an EditorPane of a specific type. If a pane of this type has been created
	 * earlier, the existing instance is returned. Otherwise a new instance is created.
	 *
	 * @param String type Type of the EditorPane, currently either 'Block' or 'Inline' is
	 *                    supported.
	 * @param Object opts Extra options for the editorpane which is used when creating a
	 *                    new instance.
	 * @return EditorPane
	 */
	ContentEditor.prototype.getEditorPane = function (type, opts) {
		var self = this;

		opts = opts || {};

		return this.panes.getInstance(type, {
			save: function (e, pane) {
				self.handleSave(e, pane);
				if (typeof opts.handleSave !== "undefined") {
					opts.handleSave(self, pane);
				}
			},
			cancel: function (e, pane) {
				self.handleCancel(e, pane);
				if (typeof opts.handleCancel !== "undefined") {
					opts.handleCancel(self, pane);
				}
			},
			ready: (typeof opts.ready !== "undefined" ? opts.ready : null)
		});
	};

	/**
	 * Return the currently open EditorPane, if any.
	 *
	 * @return EditorPane
	 */
	ContentEditor.prototype.getCurrentEditorPane = function () {
		return this.panes.getCurrent();
	};


	/*
	 * PUBLIC INTERFACE.
	 */
	
	/**
	 * Returns all content from the editor, without any custom editor
	 * HTML.
	 * @return String HTML code from editor.
	 */
	ContentEditor.prototype.getContent = function () {
		var
			$ = this.window.jQuery,
			$clones = $(this.window.document).children().clone(false),
			$fragment = null,
			html = '';

		// Strip out our custom content in the <head>
		$clones = $clones.find("meta[name='SKYPE_TOOLBAR'], script, link").remove().end();

		// Create a document fragment <div> with the content, clean up and return HTML
		$fragment = $('<div/>').append($clones)
				// Remove Content Editor elements
				.find('div.mm-editor, div.mm-add, div.mm-overlay')
					.remove().end()
				.find('span.mm-edit, span.mm-remove')
					.remove().end()
				.find('img.mm-edit')
					.remove().end()
				// Remove CKEditor elements
				.find('div[id^=cke_], div[class^=cke_]')
					.remove().end();

		// Let plugins clean up content too
		this.trigger('filtercontent.editor', [$fragment]);

		html = $fragment.html();

		// Strip XML prolog which is injected by Internet Explorer
		if ($.browser.msie) {
			html = html.replace(/<\?xml[^>]+>/gi, '');
		}
		return html;
	};

	ContentEditor.prototype.on = function (event, callback) {
		if (typeof this.listenerQueue === "undefined") {
			this.window.jQuery(this.window).on(event, callback);
		}
		else {
			this.listenerQueue.push({ e: event, fn: callback });
		}
		return this;
	};

	/**
	 * Convenience alias for triggering global events in the editor context.
	 */
	ContentEditor.prototype.trigger = function (event) {
		var $window = this.window.jQuery(this.window),
			args = Array.prototype.slice.call(arguments);
		$window.trigger.apply($window, args);
	};


	/**
	 * Utility function for inspecting script elements to find the base URL to this
	 * script. Used for referencing static CSS and image files packaged with the editor.
	 * @return String
	 */
	function findBaseUrl () {
		var scripts = document.getElementsByTagName('script'),
			len = scripts.length, i = 0,
			baseUrl;
		for ( ; i < len; i++) {
			if ((baseUrl = scripts[i].getAttribute('src') || '').indexOf('mojoeditor') !== -1) {
				baseUrl = url.basePath(baseUrl);
				if (!url.isAbsolute(baseUrl)) {
					baseUrl = url.concat(window.location.pathname, baseUrl);
				}
				return baseUrl;
			}
			else if ((baseUrl = scripts[i].getAttribute('data-main') || '') === 'src/main') {
				return url.concat(window.location.pathname, '/src/');
			}
		}
	}

	return {
		/**
		 * Initializes a Content Editor from a textarea or iframe
		 * element. Textareas are expected to contain HTML code and it will be
		 * replaced by an iframe where the HTML is injected into. Iframes are then
		 * initialized with required JavaScript libraries and CSS for a fully
		 * functionaly editor.
		 *
		 * The Content Editor has settings too, some of which are required. Specifically
		 * this is URLs for the 3rd party JavaScript dependencies, CKEditor and jQuery.
		 *
		 * @param HTMLElement el The textarea or iframe element to convert into an editor.
		 * @param Object opts    Settings for external dependencies, callbacks and custom
		 *                       behaviour. Following are all available settings:
		 *
		 *                       'ckeditor': URI to CKEditor library,
		 *                       'jquery': URI to jQuery library.
		 *                       'imageUploadUrl': URI to support uploading images to.
		 * @returns ContentEditor
		 */
		init: function (el, opts) {
			opts = type.extend({ root: findBaseUrl() }, defaults, opts);

			if (el.nodeName.toLowerCase() == 'textarea') {
				el = convertToIframe(el);
			}			

			return new ContentEditor(el, opts);
		},

		addPlugin: function (plugin) {
			if (!plugin.hasOwnProperty('register')) {
				throw new Exception("Invalid plugin signature.");
			}
			plugins.push(plugin);
		}
	};
});

require.config({
	paths: {}
});

define('main',['editor'], function (Editor) {
	var global = this;
	global.MojoEditor = Editor;
});
}());