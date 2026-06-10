export function setupDragScrub(inputEl, onChangeCb, options = {}) {
   const { step = 1, min = -Infinity, max = Infinity } = options;
   let isDragging = false;
   let startY = 0;
   let startVal = 0;

   inputEl.style.cursor = 'ns-resize';

   const onMouseMove = (e) => {
       if (!isDragging) return;
       const deltaY = startY - e.clientY;
       let newVal = startVal + (deltaY * step);
       newVal = Math.max(min, Math.min(max, newVal));

       // Handle float precision issues
       const decimals = step.toString().split('.')[1]?.length || 0;
       inputEl.value = newVal.toFixed(decimals);
       onChangeCb(parseFloat(inputEl.value));
   };

   const onMouseUp = () => {
       if (!isDragging) return;
       isDragging = false;
       document.removeEventListener('mousemove', onMouseMove);
       document.removeEventListener('mouseup', onMouseUp);
       document.body.style.cursor = '';
   };

   inputEl.addEventListener('mousedown', (e) => {
       isDragging = true;
       startY = e.clientY;
       startVal = parseFloat(inputEl.value) || 0;
       document.addEventListener('mousemove', onMouseMove);
       document.addEventListener('mouseup', onMouseUp);
       document.body.style.cursor = 'ns-resize';
       e.preventDefault(); // Prevent text selection
   });
}
