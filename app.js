document.addEventListener('DOMContentLoaded', function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput'); // garde accept="image/jpeg" ou ajoute ",image/jpg"
  const fileList = document.getElementById('fileList');
  const filesContainer = document.getElementById('filesContainer');
  const convertBtn = document.getElementById('convertBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const successSound = document.getElementById('successSound');

  let files = [];

  // --- Utilitaires ---
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function updateFileList() {
    if (files.length > 0) {
      fileList.classList.remove('hidden');
      filesContainer.innerHTML = '';
      files.forEach((file, index) => {
        const el = document.createElement('div');
        el.className = 'file-item flex items-center justify-between bg-gray-50 p-3 rounded-lg';
        el.innerHTML = `
          <div class="flex items-center space-x-3">
            <i class="fas fa-file-image text-indigo-600"></i>
            <div>
              <p class="text-sm font-medium text-gray-800">${file.name}</p>
              <p class="text-xs text-gray-500">${formatFileSize(file.size)}</p>
            </div>
          </div>
          <button class="file-remove text-red-500 opacity-100 hover:text-red-700" data-index="${index}">
            <i class="fas fa-times"></i>
          </button>
        `;
        filesContainer.appendChild(el);
      });
      document.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'));
          files.splice(idx, 1);
          updateFileList();
          convertBtn.disabled = files.length === 0;
        });
      });
    } else {
      fileList.classList.add('hidden');
    }
  }

  function addFiles(fileListLike) {
    const incoming = Array.from(fileListLike);
    const valid = incoming.filter(f =>
      /^image\/jpeg$/i.test(f.type) && f.size <= 10 * 1024 * 1024
    );
    const rejected = incoming.filter(f => !valid.includes(f));
    files = files.concat(valid);
    if (rejected.length) {
      // mini toast
      const t = document.createElement('div');
      t.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow';
      t.textContent = 'Certains fichiers ont été refusés (type non JPEG ou > 10MB).';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    }
    updateFileList();
    convertBtn.disabled = files.length === 0;
  }

  // --- Drag & Drop + Sélection ---
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false)
  );
  ['dragenter', 'dragover'].forEach(ev =>
    dropzone.addEventListener(ev, () => dropzone.classList.add('active'), false)
  );
  ['dragleave', 'drop'].forEach(ev =>
    dropzone.addEventListener(ev, () => dropzone.classList.remove('active'), false)
  );
  dropzone.addEventListener('drop', e => addFiles(e.dataTransfer.files), false);

  // Cliquer la zone ouvre le sélecteur
  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', function () {
    addFiles(this.files);
    // reset pour pouvoir re-sélectionner le même fichier ensuite
    this.value = '';
  });

  // --- Conversion JPEG → PNG ---
  function convertToPNG(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(blob => {
            if (!blob) return reject(new Error('Conversion échouée.'));
            const pngFile = new File(
              [blob],
              file.name.replace(/\.(jpe?g)$/i, '.png'),
              { type: 'image/png' }
            );
            resolve(pngFile);
          }, 'image/png');
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Progression simulée mais fluide (affiche 0→100% sur l’ensemble des fichiers)
  function simulateProgressForFile(i, total, duration = 1500) {
    return new Promise(resolve => {
      let local = 0;
      const step = 100 / (duration / 100); // maj toutes les 100ms
      const id = setInterval(() => {
        local = Math.min(100, local + step);
        const overall = Math.round(((i + local / 100) / total) * 100);
        progressBar.style.width = overall + '%';
        progressPercent.textContent = overall + '%';
        if (local >= 100) {
          clearInterval(id);
          resolve();
        }
      }, 100);
    });
  }

  function showSuccessModal(convertedFiles) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full text-center">
        <h2 class="text-2xl font-bold text-green-600 mb-4">✅ Conversion terminée !</h2>
        <p class="text-gray-700 mb-6">Vos fichiers PNG sont prêts :</p>
        <div class="space-y-3 mb-6 max-h-64 overflow-auto">
          ${convertedFiles.map(file => {
            const url = URL.createObjectURL(file);
            return `<a href="${url}" download="${file.name}"
                      class="block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                      ${file.name}
                    </a>`;
          }).join('')}
        </div>
        <button id="closeModal" class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">Fermer</button>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('closeModal').addEventListener('click', () => modal.remove());
  }

  // --- Clic "Convertir" ---
  convertBtn.addEventListener('click', async function () {
    if (!files.length) return;

    convertBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';

    const total = files.length;
    const converted = [];

    for (let i = 0; i < total; i++) {
      // Simule une attente visible (durée en f° de la taille, min 1.2s)
      const duration = Math.max(1200, Math.min(4000, Math.round(files[i].size / 1024))); // ~1ms/KB
      await simulateProgressForFile(i, total, duration);
      const png = await convertToPNG(files[i]);
      converted.push(png);
    }

    // Son de succès (peut être bloqué par le navigateur si pas d'interaction récente)
    try { successSound.currentTime = 0; await successSound.play(); } catch (e) {}

    showSuccessModal(converted);

    // Reset
    files = [];
    updateFileList();
    progressContainer.classList.add('hidden');
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    convertBtn.disabled = true;
  });
});