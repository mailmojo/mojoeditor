define(function () {
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
