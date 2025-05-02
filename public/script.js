const form = document.getElementById('bookingForm');
const signaturePad = document.getElementById('signaturePad');
const clearBtn = document.getElementById('clearSignature');
const ctx = signaturePad.getContext('2d');

// Ganti ID yang salah ("message") dengan yang betul
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');

// Resize canvas to match display size
function resizeCanvas() {
  signaturePad.width = signaturePad.offsetWidth;
  signaturePad.height = signaturePad.offsetHeight;
  ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
}
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// Drawing logic
let drawing = false;

function getPosition(e) {
  const rect = signaturePad.getBoundingClientRect();
  if (e.touches) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top,
    };
  } else {
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }
}

signaturePad.addEventListener('mousedown', e => {
  drawing = true;
  const pos = getPosition(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
});

signaturePad.addEventListener('mousemove', e => {
  if (!drawing) return;
  const pos = getPosition(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
});

signaturePad.addEventListener('mouseup', () => drawing = false);
signaturePad.addEventListener('mouseout', () => drawing = false);

signaturePad.addEventListener('touchstart', e => {
  drawing = true;
  const pos = getPosition(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
});

signaturePad.addEventListener('touchmove', e => {
  e.preventDefault(); // Elak skrin dari bergerak
  if (!drawing) return;
  const pos = getPosition(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}, { passive: false });

signaturePad.addEventListener('touchend', () => drawing = false);

// Clear signature
clearBtn.addEventListener('click', () => {
  ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
});

// Submit form
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const signatureData = signaturePad.toDataURL();
  const formData = {
    customerName: form.customerName.value,
    customerIc: form.customerIc.value,
    customerAddress: form.customerAddress.value,
    customerPhone: form.customerPhone.value,
    customerPosition: form.customerPosition.value,
    customerRace: form.customerRace.value,
    customerEmail: form.customerEmail.value,
    signatureData,
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Menghantar...";

  try {
    const res = await fetch('/submitBooking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await res.json();

    if (res.ok) {
      form.style.display = 'none';
      successMessage.textContent = result.message || 'Borang berjaya dihantar!';
      successMessage.classList.remove('hidden');
    } else {
      errorMessage.textContent = result.error || 'Ralat penghantaran.';
      errorMessage.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = "Hantar Borang";
    }
  } catch (err) {
    errorMessage.textContent = 'Ralat sambungan: ' + err.message;
    errorMessage.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = "Hantar Borang";
  }
});
