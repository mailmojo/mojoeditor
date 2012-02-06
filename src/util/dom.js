define(function () {

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
