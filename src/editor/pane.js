/**
 * Encapsulation of static interface/factory and class for EditorPane objects which manages
 * panes with WYSIWYG editors that can have different configurations (i.e. toolbars).
 */
define(['./ckeditor_config', '../util/dom'], function (editorConfig, dom) {

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
			}
		};
	}

	return {
		"init": init
	};
});
