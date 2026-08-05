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
    const cropBox = document.getElementById('cropBox'); // <-- DECLARADO

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
            // ===== INICIALIZAR CUADRADO =====
            initCropBox();
            currentDeviceId = deviceId;
        } catch (err) {
            console.error('Error al iniciar cámara:', err);
            alert('No se pudo acceder a la cámara seleccionada.');
        }
    }

    // ============================================================
    // 4. FUNCIÓN PARA INICIALIZAR EL CUADRADO
    // ============================================================
    const CROP_SIZE_FACTOR = 0.92; // ← Define una constante al principio para ajustar fácilmente

    function initCropBox() {
        const parentRect = cropBox.parentElement.getBoundingClientRect();
        const size = Math.min(parentRect.width, parentRect.height) * CROP_SIZE_FACTOR;
        cropBox.style.width = size + 'px';
        cropBox.style.height = size + 'px';
        cropBox.style.left = (parentRect.width - size) / 2 + 'px';
        cropBox.style.top = (parentRect.height - size) / 2 + 'px';

        updateLines(); // ← llama a la nueva función
    }

    function updateLines() {
        const boxWidth = cropBox.offsetWidth;
        const separationPercent = 0.80;
        const separation = boxWidth * separationPercent;
        const leftLineX = (boxWidth - separation) / 2;
        const rightLineX = leftLineX + separation;

        cropBox.querySelector('.line-left').style.left = leftLineX + 'px';
        cropBox.querySelector('.line-right').style.left = rightLineX + 'px';
    }
    // ============================================================
    // 5. CAPTURAR FOTO (SOLO DENTRO DEL CUADRADO)
    // ============================================================
    function capturePhoto() {
        if (!stream) {
            alert('Primero inicia una cámara.');
            return;
        }

        // Obtener el rectángulo del video y del crop box
        const videoRect = video.getBoundingClientRect();
        const cropRect = cropBox.getBoundingClientRect();

        // Calcular la escala para pasar de píxeles de pantalla a píxeles reales del video
        const scaleX = video.videoWidth / videoRect.width;
        const scaleY = video.videoHeight / videoRect.height;

        // Coordenadas en el video original (en píxeles reales)
        let sx = (cropRect.left - videoRect.left) * scaleX;
        let sy = (cropRect.top - videoRect.top) * scaleY;
        let sw = cropRect.width * scaleX;
        let sh = cropRect.height * scaleY;

        // Ajustar para que no se salga del video
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        sx = Math.max(0, Math.min(sx, vw - 1));
        sy = Math.max(0, Math.min(sy, vh - 1));
        sw = Math.max(1, Math.min(sw, vw - sx));
        sh = Math.max(1, Math.min(sh, vh - sy));

        // Configurar el canvas con el tamaño exacto del recorte
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);

        // Dibujar solo la parte recortada
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        // Convertir a imagen
        const dataURL = canvas.toDataURL('image/png');

        // Guardar en la galería
        photos.push({
            dataURL,
            timestamp: new Date().toLocaleString()
        });

        renderGallery();
    }

    // ============================================================
    // 6. RENDERIZAR GALERÍA
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
            item.appendChild(img);
            item.appendChild(actions);
            gallery.appendChild(item);
        });
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
    // REDIMENSIONAR CON RUEDA DEL MOUSE (scroll)
    // ============================================================
    cropBox.addEventListener('wheel', (e) => {
        e.preventDefault(); // Evita que la página se desplace

        const delta = e.deltaY > 0 ? -1 : 1; // -1 para reducir, +1 para agrandar
        const step = 10; // Cantidad de píxeles a cambiar

        const rect = cropBox.getBoundingClientRect();
        const parentRect = cropBox.parentElement.getBoundingClientRect();

        let newSize = rect.width + (delta * step);
        // Limitar tamaño mínimo y máximo
        const minSize = 30;
        const maxSize = Math.min(parentRect.width, parentRect.height);
        newSize = Math.max(minSize, Math.min(newSize, maxSize));

        // Mantener centrado al redimensionar
        const centerX = rect.left + rect.width / 2 - parentRect.left;
        const centerY = rect.top + rect.height / 2 - parentRect.top;

        cropBox.style.width = newSize + 'px';
        cropBox.style.height = newSize + 'px';
        cropBox.style.left = (centerX - newSize / 2) + 'px';
        cropBox.style.top = (centerY - newSize / 2) + 'px';

        // Evitar que se salga del contenedor
        if (parseFloat(cropBox.style.left) < 0) cropBox.style.left = '0px';
        if (parseFloat(cropBox.style.top) < 0) cropBox.style.top = '0px';

        updateLines(); // Actualizar líneas verticales
    }, { passive: false }); // passive: false para permitir e.preventDefault()
    // ============================================================
    // 8. LIMPIAR TODAS LAS FOTOS
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
    // 9. ARRASTRE DEL CUADRADO (SOLO MUEVE, NO REDIMENSIONA)
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
    // 10. BOTONES DE CONTROL (EXPANDIR, REDUCIR, REINICIAR)
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

        updateLines(); // ← cambia esto
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

        updateLines(); // ← cambia esto
    });

    document.getElementById('cropResetBtn').addEventListener('click', () => {
        const parentRect = cropBox.parentElement.getBoundingClientRect();
        const size = Math.min(parentRect.width, parentRect.height) * CROP_SIZE_FACTOR;
        cropBox.style.width = size + 'px';
        cropBox.style.height = size + 'px';
        cropBox.style.left = (parentRect.width - size) / 2 + 'px';
        cropBox.style.top = (parentRect.height - size) / 2 + 'px';

        initCropBox();  // ← AGREGAR ESTO (por si acaso)
    });

    // ============================================================
    // 11. EVENTOS DE CAMBIO DE CÁMARA, TECLADO, ETC.
    // ============================================================
    cameraSelect.addEventListener('change', async (e) => {
        const id = e.target.value;
        if (id) await startCamera(id);
    });

    document.addEventListener('keydown', (e) => {
        // ===== 1. Cerrar modal con Escape =====
        if (e.key === 'Escape') {
            const overlay = document.getElementById('confirmModal');
            if (overlay.style.display === 'flex') {
                overlay.style.display = 'none';
            }
        }

        // ===== 2. Capturar con Espacio o Enter =====
        if (e.key === ' ' || e.key === 'Space' || e.key === 'Enter') {
            // Evita que la página se desplace o envíe formularios
            e.preventDefault();
            // Llama a la función de captura
            capturePhoto();
            return; // Salimos para no ejecutar más teclas
        }

        // ===== 3. Mover el cuadrado con las flechas =====
        const STEP = 5; // píxeles que se mueve cada vez

        // Obtener la posición actual del cuadrado
        let left = parseFloat(cropBox.style.left) || 0;
        let top = parseFloat(cropBox.style.top) || 0;
        const parentRect = cropBox.parentElement.getBoundingClientRect();
        const maxL = parentRect.width - cropBox.offsetWidth;
        const maxT = parentRect.height - cropBox.offsetHeight;

        let moved = false;

        switch (e.key) {
            case 'ArrowUp':
                top = Math.max(0, top - STEP);
                moved = true;
                break;
            case 'ArrowDown':
                top = Math.min(maxT, top + STEP);
                moved = true;
                break;
            case 'ArrowLeft':
                left = Math.max(0, left - STEP);
                moved = true;
                break;
            case 'ArrowRight':
                left = Math.min(maxL, left + STEP);
                moved = true;
                break;
        }

        if (moved) {
            e.preventDefault(); // Evita que la página se desplace
            cropBox.style.left = left + 'px';
            cropBox.style.top = top + 'px';
        }

        // ===== 4. Teclas + y - para agrandar/reducir (ya las tenías) =====
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            document.getElementById('cropExpandBtn').click();
        }

        if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            document.getElementById('cropShrinkBtn').click();
        }
    });

    // ===== CÍRCULO =====
    const circleOverlay = document.getElementById('circleOverlay');
    let isCircleVisible = false; // true = visible, false = oculto

    document.getElementById('toggleCircleBtn').addEventListener('click', () => {
        isCircleVisible = !isCircleVisible;
        circleOverlay.style.display = isCircleVisible ? 'block' : 'none';
    });

    let isCrosshairVisible = true; // visible por defecto

    document.getElementById('toggleCrosshairBtn').addEventListener('click', () => {
        isCrosshairVisible = !isCrosshairVisible;
        document.getElementById('crosshair').style.display = isCrosshairVisible ? 'block' : 'none';
    });

    let isLinesVisible = false; // empieza oculto

    document.getElementById('toggleLinesBtn').addEventListener('click', () => {
        isLinesVisible = !isLinesVisible;
        const linesOverlay = document.querySelector('.lines-overlay');
        linesOverlay.style.display = isLinesVisible ? 'block' : 'none';
    });

    captureBtn.addEventListener('click', capturePhoto);
    clearBtn.addEventListener('click', clearAll);

    // ============================================================
    // 12. REAJUSTAR CUADRADO AL REDIMENSIONAR LA VENTANA
    // ============================================================
    window.addEventListener('resize', initCropBox);
    

    // ============================================================
    // 13. INICIO
    // ============================================================
    populateCameraSelector();
});