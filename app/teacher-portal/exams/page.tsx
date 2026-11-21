import {teacherClass,teacherExamData} from '@/lib/portal/teacher-entry';
import {rows} from '@/lib/portal/queries';
import {selected} from '@/lib/portal/rules';
import {getExamSettingsBundle} from '@/lib/structured-config';
import ExamMarksForm from './ExamMarksForm';
export default async function Page({searchParams}:{searchParams:Promise<{exam_id?:string;class_id?:string;subject_name?:string}>}) {
  const params = await searchParams;
  const t = await teacherClass(params.class_id); if (!t) return null;
  const {students:roster,i,scope,current} = t;
  const classes = scope.classes, classId = current?.id || '', madrasaId = i.tenant;
  const exams = await rows(()=>i.db.from('exams').select('*').eq('madrasa_id',madrasaId).order('start_date',{ascending:false}));
  const exam = selected(exams,params.exam_id), examId = exam?.id || '';
  const {subjects,students,marks} = await teacherExamData(i,scope,exam,roster,classId);
  const subject = params.subject_name ? subjects.find(d=>d.subject_name===params.subject_name) : subjects[0];
  const subjectName = subject?.subject_name || '';
  const existingMarks=marks.filter(m=>m.subject_name===subjectName);
  const gradeRules = examId ? (await getExamSettingsBundle(madrasaId,examId)).gradingConfig.rules : undefined;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">পরীক্ষার নম্বর এন্ট্রি</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          পরীক্ষা, জামাত এবং বিষয় নির্বাচন করে শিক্ষার্থীদের নম্বর ও গ্রেড লিপিবদ্ধ করুন।
        </p>
      </div>

      <ExamMarksForm
        exams={exams || []}
        classes={classes || []}
        students={subject ? students : []}
        existingMarks={existingMarks}
        currentExamId={examId}
        currentClassId={classId}
        currentSubject={subjectName}
        madrasaId={madrasaId}
        gradeRules={gradeRules} subjects={subjects} subject={subject}
      />
    </div>
  );
}
