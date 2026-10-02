/* Madhi Matrimony — small progressive enhancements; every screen works without JS. */
(function () {
	'use strict';

	// Horoscope fields only for Hindu profiles.
	document.querySelectorAll('[data-mm-religion]').forEach(function (sel) {
		var box = sel.form && sel.form.querySelector('.mm-hindu-only');
		if (!box) return;
		sel.addEventListener('change', function () {
			var hindu = sel.value === 'இந்து';
			box.hidden = !hindu;
			if (!hindu) box.querySelectorAll('input, select').forEach(function (el) { el.value = ''; });
		});
	});

	// Advanced search toggle.
	document.querySelectorAll('[data-mm-toggle]').forEach(function (btn) {
		var target = document.getElementById(btn.getAttribute('data-mm-toggle'));
		var arrow = btn.querySelector('[data-mm-arrow]');
		btn.addEventListener('click', function () {
			target.hidden = !target.hidden;
			btn.setAttribute('aria-expanded', String(!target.hidden));
			if (arrow) arrow.textContent = target.hidden ? '▼' : '▲';
		});
	});

	// Busy label + no double submit.
	document.querySelectorAll('.mm-app form').forEach(function (form) {
		form.addEventListener('submit', function (e) {
			if (form.dataset.mmSubmitting) { e.preventDefault(); return; }
			form.dataset.mmSubmitting = '1';
			var btn = e.submitter || form.querySelector('[data-mm-busy]');
			if (btn && btn.dataset.mmBusy) {
				setTimeout(function () { btn.textContent = btn.dataset.mmBusy; btn.disabled = true; }, 0);
			}
		});
	});

	// Photos: block right-click / drag, open zoom overlay on tap.
	document.addEventListener('contextmenu', function (e) {
		if (e.target.closest && e.target.closest('.mm-photo, .mm-zoom, .mm-avatar')) e.preventDefault();
	});
	document.addEventListener('dragstart', function (e) {
		if (e.target.classList && e.target.classList.contains('mm-protected')) e.preventDefault();
	});
	var zoom = document.querySelector('.mm-zoom');
	if (zoom) {
		var img = zoom.querySelector('img');
		var close = function () { zoom.hidden = true; img.src = ''; };
		document.querySelectorAll('[data-mm-zoom]').forEach(function (btn) {
			btn.addEventListener('click', function () { img.src = btn.getAttribute('data-mm-zoom'); zoom.hidden = false; });
		});
		zoom.addEventListener('click', function (e) { if (!e.target.closest('.mm-zoom-frame')) close(); });
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
	}
})();
