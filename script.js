let programStack = [];
let isRunning = false;
let currentServoAngle = 0;
let draggedItemIndex = null;
let draggedLibraryKey = null;

const BLOCK_TYPES = {
  LED_ON: { label: 'Turn LED ON', type: 'led', value: true, code: 'digitalWrite(LED_PIN, HIGH);' },
  LED_OFF: { label: 'Turn LED OFF', type: 'led', value: false, code: 'digitalWrite(LED_PIN, LOW);' },
  RGB_RED: { label: 'Set RGB: Red', type: 'rgb', value: '#ef4444', code: 'setRGB(255, 0, 0);' },
  RGB_GREEN: { label: 'Set RGB: Green', type: 'rgb', value: '#22c55e', code: 'setRGB(0, 255, 0);' },
  RGB_BLUE: { label: 'Set RGB: Blue', type: 'rgb', value: '#3b82f6', code: 'setRGB(0, 0, 255);' },
  RGB_OFF: { label: 'Turn RGB OFF', type: 'rgb', value: '#334155', code: 'setRGB(0, 0, 0);' },
  BUZZER_BEEP: { label: 'Beep Buzzer', type: 'buzzer', value: 880, code: 'tone(BUZZER_PIN, 880, 200);' },
  SERVO_ADD_90: { label: 'Add +90° to Servo', type: 'servo', delta: 90, code: 'servoAngle = constrain(servoAngle + 90, 0, 180);\nmyServo.write(servoAngle);' },
  SERVO_SUB_90: { label: 'Subtract -90° from Servo', type: 'servo', delta: -90, code: 'servoAngle = constrain(servoAngle - 90, 0, 180);\nmyServo.write(servoAngle);' },
  SERVO_ADD_45: { label: 'Add +45° to Servo', type: 'servo', delta: 45, code: 'servoAngle = constrain(servoAngle + 45, 0, 180);\nmyServo.write(servoAngle);' },
  WAIT_1S: { label: 'Wait 1 Second', type: 'wait', value: 1000, code: 'delay(1000);' },
  REPEAT_2X: { label: 'Repeat Sequence 2x', type: 'repeat', times: 2, code: '// Repeat sequence loop\nfor (int r = 0; r < 2; r++) {' }
};

// --- DRAG AND DROP HANDLERS ---
function handleDragStart(e, key) {
  draggedLibraryKey = key;
  draggedItemIndex = null;
}

function handleSequenceDragStart(e, index) {
  draggedItemIndex = index;
  draggedLibraryKey = null;
  e.target.classList.add('dragging-item');
}

function handleSequenceDragEnd(e) {
  e.target.classList.remove('dragging-item');
}

function handleWorkspaceDragOver(e) {
  e.preventDefault();
  document.getElementById('program-list').classList.add('drag-over');
}

function handleWorkspaceDrop(e) {
  e.preventDefault();
  const listEl = document.getElementById('program-list');
  listEl.classList.remove('drag-over');

  if (isRunning) return;

  if (draggedLibraryKey) {
    addBlock(draggedLibraryKey);
  } else if (draggedItemIndex !== null) {
    // Reorder inside list
    const dropTarget = e.target.closest('.program-item');
    if (dropTarget) {
      const targetIndex = parseInt(dropTarget.getAttribute('data-index'));
      const movedItem = programStack.splice(draggedItemIndex, 1)[0];
      programStack.splice(targetIndex, 0, movedItem);
      renderWorkspace();
    }
  }
}

// --- WORKSPACE & RENDER ---
function addBlock(blockKey) {
  if (isRunning) return;
  programStack.push({ ...BLOCK_TYPES[blockKey] });
  renderWorkspace();
}

function removeBlock(index) {
  if (isRunning) return;
  programStack.splice(index, 1);
  renderWorkspace();
}

function clearProgram() {
  if (isRunning) return;
  programStack = [];
  renderWorkspace();
  logConsole("Workspace cleared.");
}

function renderWorkspace() {
  const listEl = document.getElementById('program-list');
  listEl.innerHTML = '';

  if (programStack.length === 0) {
    listEl.innerHTML = '<li class="empty-msg">Drag or click blocks on the left to add!</li>';
    generateCode();
    return;
  }

  programStack.forEach((block, idx) => {
    const li = document.createElement('li');
    li.className = 'program-item';
    li.id = `step-${idx}`;
    li.setAttribute('data-index', idx);
    li.setAttribute('draggable', 'true');
    li.setAttribute('ondragstart', `handleSequenceDragStart(event, ${idx})`);
    li.setAttribute('ondragend', 'handleSequenceDragEnd(event)');
    li.innerHTML = `
      <span>☰ ${idx + 1}. ${block.label}</span>
      <button class="remove-btn" onclick="removeBlock(${idx})">✕</button>
    `;
    listEl.appendChild(li);
  });

  generateCode();
}

// --- SIMULATION EXECUTION ---
async function runProgram() {
  if (isRunning || programStack.length === 0) return;
  
  isRunning = true;
  document.getElementById('run-btn').innerText = '⏳ Running...';
  logConsole("Starting program execution...");

  let loopMultiplier = 1;
  let executionList = [...programStack];

  // Check for repeat wrapper block
  if (executionList.some(b => b.type === 'repeat')) {
    const repeatBlock = executionList.find(b => b.type === 'repeat');
    const innerBlocks = executionList.filter(b => b.type !== 'repeat');
    executionList = [];
    for (let r = 0; r < repeatBlock.times; r++) {
      executionList.push(...innerBlocks);
    }
  }

  for (let i = 0; i < executionList.length; i++) {
    const block = executionList[i];
    highlightStep(i % programStack.length);

    if (block.type === 'led') {
      const ledEl = document.getElementById('sim-led');
      if (block.value) {
        ledEl.classList.add('on');
        logConsole("GPIO: LED pin set to HIGH");
      } else {
        ledEl.classList.remove('on');
        logConsole("GPIO: LED pin set to LOW");
      }
    } else if (block.type === 'rgb') {
      const rgbEl = document.getElementById('sim-rgb');
      rgbEl.style.background = block.value;
      if (block.value !== '#334155') {
        rgbEl.style.boxShadow = `0 0 15px ${block.value}`;
      } else {
        rgbEl.style.boxShadow = 'inset 0 0 5px #000';
      }
      logConsole(`RGB: Color updated to ${block.value}`);
    } else if (block.type === 'buzzer') {
      playAudioTone(block.value);
      logConsole(`PWM: Playing audio tone at ${block.value}Hz`);
    } else if (block.type === 'servo') {
      currentServoAngle = Math.min(180, Math.max(0, currentServoAngle + block.delta));
      const armEl = document.getElementById('sim-servo-arm');
      armEl.style.transform = `rotate(${currentServoAngle}deg)`;
      document.getElementById('servo-angle-label').innerText = `Servo: ${currentServoAngle}°`;
      logConsole(`PWM: Servo shifted by ${block.delta}° (Current: ${currentServoAngle}°)`);
    } else if (block.type === 'wait') {
      logConsole(`DELAY: Waiting ${block.value / 1000}s...`);
      await new Promise(res => setTimeout(res, block.value));
    }

    if (block.type !== 'wait') {
      await new Promise(res => setTimeout(res, 350));
    }
  }

  clearStepHighlights();
  logConsole("Done!");
  document.getElementById('run-btn').innerText = '▶ Run Program';
  isRunning = false;
}

function playAudioTone(freq) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // Audio context fallback if blocked by browser policy
  }
}

function highlightStep(index) {
  clearStepHighlights();
  const stepEl = document.getElementById(`step-${index}`);
  if (stepEl) stepEl.classList.add('active-step');
}

function clearStepHighlights() {
  document.querySelectorAll('.program-item').forEach(el => el.classList.remove('active-step'));
}

function resetSimulation() {
  if (isRunning) return;

  const ledEl = document.getElementById('sim-led');
  if (ledEl) ledEl.classList.remove('on');

  const rgbEl = document.getElementById('sim-rgb');
  if (rgbEl) {
    rgbEl.style.background = '#334155';
    rgbEl.style.boxShadow = 'inset 0 0 5px #000';
  }

  currentServoAngle = 0;
  const armEl = document.getElementById('sim-servo-arm');
  if (armEl) armEl.style.transform = 'rotate(0deg)';
  document.getElementById('servo-angle-label').innerText = 'Servo: 0°';

  logConsole("Hardware reset to defaults (LED: OFF, RGB: OFF, Servo: 0°).");
}

function logConsole(text) {
  const consoleEl = document.getElementById('console-output');
  if (consoleEl) consoleEl.innerText = `> ${text}`;
}

// --- CODE GENERATOR & TAB SWITCHING ---
function switchTab(tabName) {
  document.getElementById('tab-btn-sim').classList.toggle('active', tabName === 'sim');
  document.getElementById('tab-btn-code').classList.toggle('active', tabName === 'code');
  document.getElementById('view-sim').classList.toggle('active', tabName === 'sim');
  document.getElementById('view-code').classList.toggle('active', tabName === 'code');
}

function generateCode() {
  let codeStr = `#include <Servo.h>\n\nconst int LED_PIN = 13;\nconst int BUZZER_PIN = 8;\nServo myServo;\nint servoAngle = 0;\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  pinMode(BUZZER_PIN, OUTPUT);\n  myServo.attach(9);\n  myServo.write(0);\n}\n\nvoid loop() {\n`;

  if (programStack.length === 0) {
    codeStr += `  // No blocks added yet\n`;
  } else {
    programStack.forEach(block => {
      const indented = block.code.split('\n').map(line => `  ${line}`).join('\n');
      codeStr += `${indented}\n`;
    });
  }

  codeStr += `  delay(1000);\n}`;
  document.getElementById('code-output').textContent = codeStr;
}