/***********************
 SUPABASE CONFIG
************************/
const supabase = window.supabase.createClient(
  'https://jvpsnptljywlkjwdrluk.supabase.co',
  'sb_publishable_seGVhrrHRRpE2yVD_huviQ_UjYZrH6R'
);

/***********************
 GLOBAL STATE
************************/
let teachers = [];
let currentUser = null;

/***********************
 NAVIGATION
************************/
function show(screenId) {
  document.querySelectorAll('.container > div')
    .forEach(d => d.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

function showLogin() { show('login-screen'); }
function showTeacherSelect() { loadTeachers(); show('teacher-select'); }
function showAdminLogin() { show('admin-login'); }
function logout() {
  currentUser = null;
  showLogin();
}

/***********************
 LOAD TEACHERS (Exclude Admins)
************************/
async function loadTeachers() {
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('is_active', true)
    .not('role', 'eq', 'நிர்வாகம்')
    .order('class', { ascending: true });

  if (error) {
    alert('Failed to load teachers');
    return;
  }

  teachers = data;

  const list = document.getElementById('teacher-list');
  list.innerHTML = teachers.map(t => `
    <div class="teacher-card" onclick="teacherLogin('${t.id}')">
      <strong>${t.first_name ?? ''} ${t.last_name ?? ''}</strong><br/>
      <small>${t.class ?? '-'} | ${t.role}</small>
    </div>
  `).join('');
}

/***********************
 TEACHER LOGIN & ATTENDANCE
************************/
function teacherLogin(id) {
  currentUser = teachers.find(t => t.id === id);

  document.getElementById('teacher-name').textContent =
    `${currentUser.first_name ?? ''} ${currentUser.last_name ?? ''}`;

  document.getElementById('teacher-role').textContent =
    `${currentUser.role} – ${currentUser.class ?? ''}`;

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('teacher-date').value = today;

  show('teacher-dashboard');
  loadTeacherStatus();
}

async function loadTeacherStatus() {
  const date = document.getElementById('teacher-date').value;

  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('teacher_id', currentUser.id)
    .eq('date', date)
    .maybeSingle();

  const box = document.getElementById('teacher-status');

  if (!data) {
    box.innerHTML = `
      <button onclick="markPresent()">✓ Mark Present</button>
    `;
    return;
  }

  if (data.status === 'pending') {
    box.innerHTML = `<div class="status pending">⏳ Pending approval</div>`;
  } else if (data.status === 'approved') {
    box.innerHTML = `<div class="status approved">✓ Approved</div>`;
  } else {
    box.innerHTML = `
      <div class="status rejected">✗ Rejected</div>
      <button onclick="markPresent()">Mark Again</button>
    `;
  }
}

async function markPresent() {
  const date = document.getElementById('teacher-date').value;

  await supabase.from('attendance').upsert({
    teacher_id: currentUser.id,
    date: date,
    status: 'pending'
  });

  loadTeacherStatus();
}

/***********************
 ADMIN (STYRE) LOGIN
************************/
function adminLogin() {
  const u = document.getElementById('admin-user').value;
  const p = document.getElementById('admin-pass').value;

  if (u === 'admin' && p === 'admin123') {
    document.getElementById('admin-date').value =
      new Date().toISOString().split('T')[0];

    show('admin-dashboard');
    loadAdminDashboard();
  } else {
    alert('Invalid admin credentials');
  }
}

/***********************
 ADMIN DASHBOARD
************************/
async function loadAdminDashboard() {
  const date = document.getElementById('admin-date').value;

  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      status,
      teachers (
        first_name,
        last_name,
        class,
        role
      )
    `)
    .eq('date', date)
    .order('teachers.class', { ascending: true });

  if (error) {
    alert('Failed to load attendance');
    return;
  }

  const div = document.getElementById('admin-records');

  if (!data || data.length === 0) {
    div.innerHTML = '<p>No attendance marked for this date.</p>';
    return;
  }

  div.innerHTML = data.map(r => `
    <div class="teacher-card">
      <strong>${r.teachers.first_name ?? ''} ${r.teachers.last_name ?? ''}</strong><br/>
      <small>Class: ${r.teachers.class ?? '-'} | ${r.teachers.role}</small><br/>
      <small>Status: <strong>${r.status}</strong></small><br/>

      ${r.status === 'pending' ? `
        <button onclick="updateStatus('${r.id}','approved')">Approve</button>
        <button class="secondary" onclick="updateStatus('${r.id}','rejected')">Reject</button>
      ` : ''}
    </div>
  `).join('');
}

async function updateStatus(attendanceId, status) {
  await supabase
    .from('attendance')
    .update({
      status: status,
      approved_at: new Date()
    })
    .eq('id', attendanceId);

  loadAdminDashboard();
}
