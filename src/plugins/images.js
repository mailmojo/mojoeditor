define(['../util/dom'], function (dom) {
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
