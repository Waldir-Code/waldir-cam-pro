document.addEventListener('DOMContentLoaded', () => {
    // ===== ELEMENTOS DOM =====
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const cameraSelect = document.getElementById('cameraSelect');
    const captureBtn = document.getElementById('captureBtn');
    const clearBtn = document.getElementById('clearBtn');
    const gallery = document.getElementById('gallery');
    const countPhotos = document.getElementById('countPhotos');
    const cropBox = document.getElementById('cropBox');

    let stream = null;
    let photos = [];
    let currentDeviceId = null;

    // ============================================================
    // 1. OBTENER CÁMARAS
    // ============================================================
    async function getCameras() {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (_) { /* permiso denegado o sin cámara */ }
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(d => d.kind === 'videoinput');
    }

    // ============================================================
    // 2. POBLAR SELECTOR
    // ============================================================
    async function populateCameraSelector() {
        const cameras = await getCameras();
        cameraSelect.innerHTML = '';
        if (cameras.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No hay cámaras';
            cameraSelect.appendChild(opt);
            return;
        }
        cameras.forEach((cam, i) => {
            const opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = cam.label || `Cámara ${i + 1}`;
            cameraSelect.appendChild(opt);
        });
        if (cameras.length > 0) {
            cameraSelect.value = cameras[0].deviceId;
            await startCamera(cameras[0].deviceId);
        }
    }

    // ============================================================
    // 3. INICIAR CÁMARA + INICIALIZAR CUADRADO
    // ============================================================
    async function startCamera(deviceId) {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
        }
        const constraints = {
            video: {
                deviceId: { exact: deviceId },
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'environment'
            },
            audio: false
        };
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            await video.play();
            initCropBox();
            currentDeviceId = deviceId;
        } catch (err) {
            console.error('Error al iniciar cámara:', err);
            alert('No se pudo acceder a la cámara seleccionada.');
        }
    }

    // ============================================================
    // 4. INICIALIZAR / REINICIALIZAR EL CUADRADO DE RECORTE
    // ============================================================
    const CROP_SIZE_FACTOR = 0.92;

    function initCropBox() {
        const parent = cropBox.parentElement;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        if (parentRect.width === 0 || parentRect.height === 0) return;

        const size = Math.min(parentRect.width, parentRect.height) * CROP_SIZE_FACTOR;
        cropBox.style.width = size + 'px';
        cropBox.style.height = size + 'px';
        cropBox.style.left = (parentRect.width - size) / 2 + 'px';
        cropBox.style.top = (parentRect.height - size) / 2 + 'px';
    }

    // ============================================================
    // 5. CAPTURAR FOTO (DENTRO DEL CUADRADO)
    // ============================================================
    function capturePhoto() {
        if (!stream) {
            alert('Primero inicia una cámara.');
            return;
        }

        const videoRect = video.getBoundingClientRect();
        const cropRect = cropBox.getBoundingClientRect();

        const scaleX = video.videoWidth / videoRect.width;
        const scaleY = video.videoHeight / videoRect.height;

        let sx = (cropRect.left - videoRect.left) * scaleX;
        let sy = (cropRect.top - videoRect.top) * scaleY;
        let sw = cropRect.width * scaleX;
        let sh = cropRect.height * scaleY;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        sx = Math.max(0, Math.min(sx, vw - 1));
        sy = Math.max(0, Math.min(sy, vh - 1));
        sw = Math.max(1, Math.min(sw, vw - sx));
        sh = Math.max(1, Math.min(sh, vh - sy));

        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);

        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        const dataURL = canvas.toDataURL('image/png');

        photos.push({
            dataURL,
            timestamp: new Date().toLocaleString()
        });

        renderGallery();
    }

    // ============================================================
    // 6. RENDERIZAR GALERÍA (con numeración)
    // ============================================================
    function renderGallery() {
        gallery.innerHTML = '';
        if (photos.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-message';
            empty.textContent = '📷 No hay fotos capturadas aún.';
            gallery.appendChild(empty);
            countPhotos.textContent = '0';
            return;
        }
        countPhotos.textContent = photos.length;
        photos.forEach((photo, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            // Número de foto (círculo en esquina)
            const number = document.createElement('div');
            number.className = 'photo-number';
            number.textContent = index + 1;

            const img = document.createElement('img');
            img.src = photo.dataURL;
            img.alt = `Foto ${index + 1}`;

            const actions = document.createElement('div');
            actions.className = 'actions';
            const downloadBtn = document.createElement('button');
            downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
            downloadBtn.title = 'Descargar';
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.download = `foto_${index + 1}_${Date.now()}.png`;
                link.href = photo.dataURL;
                link.click();
            });
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.title = 'Eliminar';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                photos.splice(index, 1);
                renderGallery();
            });
            actions.appendChild(downloadBtn);
            actions.appendChild(deleteBtn);

            // Orden de apilado: número, imagen, acciones
            item.appendChild(number);
            item.appendChild(img);
            item.appendChild(actions);
            gallery.appendChild(item);
        });

        // Desplazar automáticamente a la última foto
        gallery.scrollTop = gallery.scrollHeight;
    }

    // ============================================================
    // 7. MODAL DE CONFIRMACIÓN
    // ============================================================
    function showConfirmModal({ title, message, onConfirm, onCancel }) {
        const overlay = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const acceptBtn = document.getElementById('confirmAcceptBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        titleEl.textContent = title || '¿Estás seguro?';
        messageEl.textContent = message || 'Esta acción no se puede deshacer.';
        overlay.style.display = 'flex';

        const newAccept = acceptBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        acceptBtn.replaceWith(newAccept);
        cancelBtn.replaceWith(newCancel);

        newAccept.addEventListener('click', () => {
            overlay.style.display = 'none';
            if (onConfirm) onConfirm();
        });
        newCancel.addEventListener('click', () => {
            overlay.style.display = 'none';
            if (onCancel) onCancel();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
                if (onCancel) onCancel();
            }
        });
    }

    // ============================================================
    // 8. REDIMENSIONAR CON RUEDA (SCROLL)
    // ============================================================
    cropBox.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const step = 10;
        const rect = cropBox.getBoundingClientRect();
        const parentRect = cropBox.parentElement.getBoundingClientRect();

        let newSize = rect.width + (delta * step);
        const minSize = 30;
        const maxSize = Math.min(parentRect.width, parentRect.height);
        newSize = Math.max(minSize, Math.min(newSize, maxSize));

        const centerX = rect.left + rect.width / 2 - parentRect.left;
        const centerY = rect.top + rect.height / 2 - parentRect.top;

        cropBox.style.width = newSize + 'px';
        cropBox.style.height = newSize + 'px';
        cropBox.style.left = (centerX - newSize / 2) + 'px';
        cropBox.style.top = (centerY - newSize / 2) + 'px';

        if (parseFloat(cropBox.style.left) < 0) cropBox.style.left = '0px';
        if (parseFloat(cropBox.style.top) < 0) cropBox.style.top = '0px';
    }, { passive: false });

    // ============================================================
    // 9. LIMPIAR TODAS LAS FOTOS
    // ============================================================
    function clearAll() {
        if (photos.length === 0) return;
        showConfirmModal({
            title: '¿Eliminar todas las fotos?',
            message: `Se eliminarán ${photos.length} foto(s) capturadas. Esta acción no se puede deshacer.`,
            onConfirm: () => {
                photos = [];
                renderGallery();
            },
            onCancel: () => {}
        });
    }

    // ============================================================
    // 10. ARRASTRE DEL CUADRADO
    // ============================================================
    let isDragging = false;
    let startX, startY, startL, startT;

    cropBox.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = cropBox.getBoundingClientRect();
        const parentRect = cropBox.parentElement.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startL = rect.left - parentRect.left;
        startT = rect.top - parentRect.top;
        cropBox.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const parentRect = cropBox.parentElement.getBoundingClientRect();
        let newL = startL + (e.clientX - startX);
        let newT = startT + (e.clientY - startY);
        const maxL = parentRect.width - cropBox.offsetWidth;
        const maxT = parentRect.height - cropBox.offsetHeight;
        newL = Math.max(0, Math.min(newL, maxL));
        newT = Math.max(0, Math.min(newT, maxT));
        cropBox.style.left = newL + 'px';
        cropBox.style.top = newT + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            cropBox.style.cursor = 'move';
        }
    });

    // ============================================================
    // 11. BOTONES DE CONTROL (EXPANDIR, REDUCIR, REINICIAR)
    // ============================================================
    document.getElementById('cropExpandBtn').addEventListener('click', () => {
        const rect = cropBox.getBoundingClientRect();
        const parentRect = cropBox.parentElement.getBoundingClientRect();
        let newSize = Math.min(rect.width + 20, parentRect.width, parentRect.height);
        const centerX = rect.left + rect.width / 2 - parentRect.left;
        const centerY = rect.top + rect.height / 2 - parentRect.top;
        cropBox.style.width = newSize + 'px';
        cropBox.style.height = newSize + 'px';
        cropBox.style.left = (centerX - newSize / 2) + 'px';
        cropBox.style.top = (centerY - newSize / 2) + 'px';
        if (parseFloat(cropBox.style.left) < 0) cropBox.style.left = '0px';
        if (parseFloat(cropBox.style.top) < 0) cropBox.style.top = '0px';
    });

    document.getElementById('cropShrinkBtn').addEventListener('click', () => {
        const rect = cropBox.getBoundingClientRect();
        const parentRect = cropBox.parentElement.getBoundingClientRect();
        let newSize = Math.max(rect.width - 20, 30);
        const centerX = rect.left + rect.width / 2 - parentRect.left;
        const centerY = rect.top + rect.height / 2 - parentRect.top;
        cropBox.style.width = newSize + 'px';
        cropBox.style.height = newSize + 'px';
        cropBox.style.left = (centerX - newSize / 2) + 'px';
        cropBox.style.top = (centerY - newSize / 2) + 'px';
        if (parseFloat(cropBox.style.left) < 0) cropBox.style.left = '0px';
        if (parseFloat(cropBox.style.top) < 0) cropBox.style.top = '0px';
    });

    document.getElementById('cropResetBtn').addEventListener('click', () => {
        initCropBox();
    });

    // ============================================================
    // 12. TOGGLES
    // ============================================================
    const circleOverlay = document.getElementById('circleOverlay');
    let isCircleVisible = false;
    document.getElementById('toggleCircleBtn').addEventListener('click', () => {
        isCircleVisible = !isCircleVisible;
        circleOverlay.style.display = isCircleVisible ? 'block' : 'none';
    });

    let isCrosshairVisible = true;
    document.getElementById('toggleCrosshairBtn').addEventListener('click', () => {
        isCrosshairVisible = !isCrosshairVisible;
        document.getElementById('crosshair').style.display = isCrosshairVisible ? 'block' : 'none';
    });

    let isLinesVisible = false;
    document.getElementById('toggleLinesBtn').addEventListener('click', () => {
        isLinesVisible = !isLinesVisible;
        const linesOverlay = document.querySelector('.lines-overlay');
        linesOverlay.style.display = isLinesVisible ? 'block' : 'none';
    });

    // ============================================================
    // 13. EVENTOS DE CÁMARA, TECLADO, ETC.
    // ============================================================
    cameraSelect.addEventListener('change', async (e) => {
        const id = e.target.value;
        if (id) await startCamera(id);
    });

    document.addEventListener('keydown', (e) => {
        // Escape cierra modal
        if (e.key === 'Escape') {
            const overlay = document.getElementById('confirmModal');
            if (overlay.style.display === 'flex') {
                overlay.style.display = 'none';
            }
        }

        // Espacio o Enter capturan
        if (e.key === ' ' || e.key === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            capturePhoto();
            return;
        }

        // Flechas mueven el cuadro
        const STEP = 5;
        let left = parseFloat(cropBox.style.left) || 0;
        let top = parseFloat(cropBox.style.top) || 0;
        const parentRect = cropBox.parentElement.getBoundingClientRect();
        const maxL = parentRect.width - cropBox.offsetWidth;
        const maxT = parentRect.height - cropBox.offsetHeight;
        let moved = false;

        switch (e.key) {
            case 'ArrowUp':    top = Math.max(0, top - STEP); moved = true; break;
            case 'ArrowDown':  top = Math.min(maxT, top + STEP); moved = true; break;
            case 'ArrowLeft':  left = Math.max(0, left - STEP); moved = true; break;
            case 'ArrowRight': left = Math.min(maxL, left + STEP); moved = true; break;
        }

        if (moved) {
            e.preventDefault();
            cropBox.style.left = left + 'px';
            cropBox.style.top = top + 'px';
        }

        // + y - agrandan / reducen
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            document.getElementById('cropExpandBtn').click();
        }
        if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            document.getElementById('cropShrinkBtn').click();
        }
    });

    captureBtn.addEventListener('click', capturePhoto);
    clearBtn.addEventListener('click', clearAll);

    // ============================================================
    // 14. REAJUSTAR CUADRADO AL REDIMENSIONAR
    // ============================================================
    window.addEventListener('resize', initCropBox);

    // ============================================================
    // 15. INICIO
    // ============================================================
    populateCameraSelector();
});