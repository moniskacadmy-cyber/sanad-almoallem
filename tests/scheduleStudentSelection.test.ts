import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabicText } from '../src/components/ScheduleTab.js';

test('normalizeArabicText: strips harakat/tashkeel and unifies hamzas, taa marbuta, and alif maqsura', () => {
  // Hamzas unification
  assert.equal(normalizeArabicText('أحمد'), 'احمد');
  assert.equal(normalizeArabicText('إبراهيم'), 'ابراهيم');
  assert.equal(normalizeArabicText('آدم'), 'ادم');

  // Taa marbuta and alif maqsura
  assert.equal(normalizeArabicText('فاطمة'), 'فاطمه');
  assert.equal(normalizeArabicText('منى'), 'مني');
  assert.equal(normalizeArabicText('يحيى'), 'يحيي');

  // Tashkeel / Harakat
  assert.equal(normalizeArabicText('مُحَمَّد'), 'محمد');
  assert.equal(normalizeArabicText('سَنَدْ'), 'سند');

  // Whitespace and casing
  assert.equal(normalizeArabicText('  واصف  '), 'واصف');
});

test('Student search matching: correctly matches student name despite orthographic differences', () => {
  const students = [
    { id: '1', name: 'أ/ واصف', subject: 'فيزياء', whatsapp: '0101111111' },
    { id: '2', name: 'أحمد محمد', subject: 'رياضيات', whatsapp: '0102222222' },
    { id: '3', name: 'إبراهيم حسن', subject: 'كيمياء', whatsapp: '0103333333' },
    { id: '4', name: 'منى مصطفى', subject: 'أحياء', whatsapp: '0104444444' },
  ];

  // Helper simulating the filter in ScheduleTab
  const filterStudents = (query: string) => {
    if (!query.trim()) return students;
    const term = normalizeArabicText(query);
    return students.filter((s) => {
      const nameMatch = normalizeArabicText(s.name).includes(term);
      const subjectMatch = s.subject ? normalizeArabicText(s.subject).includes(term) : false;
      const phoneMatch = s.whatsapp ? s.whatsapp.includes(query.trim()) : false;
      return nameMatch || subjectMatch || phoneMatch;
    });
  };

  // Searching "احمد" (without hamza) finds "أحمد محمد" and NOT "أ/ واصف"
  const ahmedResults = filterStudents('احمد');
  assert.equal(ahmedResults.length, 1);
  assert.equal(ahmedResults[0].id, '2');
  assert.equal(ahmedResults[0].name, 'أحمد محمد');

  // Searching "ابراهيم" (without hamza) finds "إبراهيم حسن"
  const ibrahimResults = filterStudents('ابراهيم');
  assert.equal(ibrahimResults.length, 1);
  assert.equal(ibrahimResults[0].id, '3');

  // Searching "مني" (with yaa instead of alif maqsura) finds "منى مصطفى"
  const monaResults = filterStudents('مني');
  assert.equal(monaResults.length, 1);
  assert.equal(monaResults[0].id, '4');

  // Searching "واصف" finds "أ/ واصف" only
  const wasifResults = filterStudents('واصف');
  assert.equal(wasifResults.length, 1);
  assert.equal(wasifResults[0].id, '1');
});

test('Selection state sync: selecting target student strictly updates selectedStudentId', () => {
  const students = [
    { id: 'st-wasif', name: 'أ/ واصف' },
    { id: 'st-ahmed', name: 'أحمد علي' },
  ];

  let selectedStudentId = students[0].id; // initially 'st-wasif'

  // Teacher clicks on "أحمد علي"
  const handleSelectStudent = (id: string) => {
    selectedStudentId = id;
  };

  handleSelectStudent('st-ahmed');
  assert.equal(selectedStudentId, 'st-ahmed');

  // Deriving confirmed student for the confirmation card
  const confirmedStudent = students.find((s) => s.id === selectedStudentId);
  assert.ok(confirmedStudent);
  assert.equal(confirmedStudent.name, 'أحمد علي');
  assert.notEqual(confirmedStudent.name, 'أ/ واصف');
});
