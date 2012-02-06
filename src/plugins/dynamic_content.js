define(['locales', 'util/datetime'], function (locales, datetime) {
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
