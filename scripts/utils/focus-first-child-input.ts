export function focusFirstChildInput(parent: HTMLElement) {
    const loadingStartTimestamp = Date.now();
    let lastElementCount = null;

    /**
     * Abort operation if user focuses any element first.
     */
    function handleManualFocus() {
        clearInterval(interval);
        parent.removeEventListener('focus', handleManualFocus, true);
    }

    parent.addEventListener('focus', handleManualFocus, true);

    /**
     * Use interval to approximately determine when fields have loaded.
     */
    const interval = setInterval(() => {
        if (Date.now() - loadingStartTimestamp > 5000) {
            // stop trying after 5s
            // it's possible no inputs are ever rendered
            clearInterval(interval);
        } else {
            const elements: Array<HTMLElement> = Array.from(
                parent.querySelectorAll('input, textarea, [contenteditable]'),
            );

            if (elements.length < 1) {
                return;
            }

            if (lastElementCount == null) {
                lastElementCount = elements.length;
            } else if (lastElementCount !== elements.length) {
                lastElementCount = elements.length;
            } else {
                parent.removeEventListener('focus', handleManualFocus, true);
                clearInterval(interval);

                if (elements.length > 0) {
                    elements[0].focus();
                }
            }
        }
    }, 100);

    return {
        cancel: () => {
            clearInterval(interval);
        },
    };
}
