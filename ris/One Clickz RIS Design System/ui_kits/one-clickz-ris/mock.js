/* Mock clinic data for the One Clickz RIS kit. Shapes mirror the real
   TypeScript interfaces in the ris/ui/src feature api modules. */

window.MOCK = (function () {
  const services = [
    { id: 1, code: 'US-ABD', name: 'Ultrasound abdomen',      modality: 'US', price: '1200' },
    { id: 2, code: 'US-OBS', name: 'Ultrasound obstetric',    modality: 'US', price: '1500' },
    { id: 3, code: 'US-PEL', name: 'Ultrasound pelvis',       modality: 'US', price: '1300' },
    { id: 4, code: 'CT-HEAD',name: 'CT head plain',           modality: 'CT', price: '3500' },
    { id: 5, code: 'CT-ABD', name: 'CT abdomen contrast',     modality: 'CT', price: '6500' },
    { id: 6, code: 'XR-CHE', name: 'X-Ray chest PA',          modality: 'XR', price: '450' },
    { id: 7, code: 'MR-BRN', name: 'MRI brain',               modality: 'MR', price: '7800' },
    { id: 8, code: 'MG-BIL', name: 'Mammography bilateral',   modality: 'MG', price: '2200' },
  ];

  const referringDoctors = [
    { id: 1, name: 'Dr. Meena Iyer',     clinic_name: 'Iyer Womens Clinic', commission_type: 'percent', commission_value: '10' },
    { id: 2, name: 'Dr. S. Raghavan',    clinic_name: 'Raghavan Polyclinic',commission_type: 'percent', commission_value: '12' },
    { id: 3, name: 'Dr. Anil Kapoor',    clinic_name: 'City Care Hospital', commission_type: 'flat',    commission_value: '150' },
    { id: 4, name: 'Dr. Farah Khan',     clinic_name: 'Sunrise Diagnostics',commission_type: 'percent', commission_value: '8' },
  ];

  const patients = [
    { id: 11, mrn: 'MRN-100847', full_name: 'Asha Verma',      sex: 'female', age_years: 34, phone: '98201 44521', husband_or_father_name: 'Rakesh Verma' },
    { id: 12, mrn: 'MRN-100848', full_name: 'Ravi Kumar',      sex: 'male',   age_years: 51, phone: '99300 18834', husband_or_father_name: 'Late Mohan Kumar' },
    { id: 13, mrn: 'MRN-100849', full_name: 'Sunita Patil',    sex: 'female', age_years: 28, phone: '90041 22119', husband_or_father_name: 'Devendra Patil' },
    { id: 14, mrn: 'MRN-100850', full_name: 'Imran Sheikh',    sex: 'male',   age_years: 42, phone: '97694 55012', husband_or_father_name: 'Yusuf Sheikh' },
    { id: 15, mrn: 'MRN-100851', full_name: 'Priya Nair',      sex: 'female', age_years: 31, phone: '88795 31200', husband_or_father_name: 'Arjun Nair' },
  ];

  const worklist = [
    { id: 201, accession_number: 'ACC-2026-004812', modality: 'US', status: 'acquired',    patient_name: 'Asha Verma',   mrn:'MRN-100847', sex:'F', age_years:34, service_name:'Ultrasound obstetric', scheduled:'09:10', study_instance_uid:'1.2.840…4812', doctor:null },
    { id: 202, accession_number: 'ACC-2026-004813', modality: 'CT', status: 'acquired',    patient_name: 'Ravi Kumar',   mrn:'MRN-100848', sex:'M', age_years:51, service_name:'CT abdomen contrast', scheduled:'09:25', study_instance_uid:'1.2.840…4813', doctor:null },
    { id: 203, accession_number: 'ACC-2026-004809', modality: 'MR', status: 'in_progress', patient_name: 'Imran Sheikh', mrn:'MRN-100850', sex:'M', age_years:42, service_name:'MRI brain', scheduled:'08:40', study_instance_uid:'1.2.840…4809', doctor:'Dr. Rao' },
    { id: 204, accession_number: 'ACC-2026-004807', modality: 'US', status: 'in_progress', patient_name: 'Sunita Patil', mrn:'MRN-100849', sex:'F', age_years:28, service_name:'Ultrasound pelvis', scheduled:'08:30', study_instance_uid:'1.2.840…4807', doctor:'Dr. Rao' },
    { id: 205, accession_number: 'ACC-2026-004802', modality: 'XR', status: 'reported',    patient_name: 'Priya Nair',   mrn:'MRN-100851', sex:'F', age_years:31, service_name:'X-Ray chest PA', scheduled:'08:05', study_instance_uid:'1.2.840…4802', doctor:'Dr. Rao' },
    { id: 206, accession_number: 'ACC-2026-004801', modality: 'CT', status: 'reported',    patient_name: 'Mohan Das',    mrn:'MRN-100844', sex:'M', age_years:60, service_name:'CT head plain', scheduled:'07:55', study_instance_uid:'1.2.840…4801', doctor:'Dr. Rao' },
  ];

  const collection = [
    { id: 205, accession_number:'ACC-2026-004802', patient_name:'Priya Nair', service_name:'X-Ray chest PA', mrn:'MRN-100851' },
    { id: 206, accession_number:'ACC-2026-004801', patient_name:'Mohan Das',  service_name:'CT head plain',  mrn:'MRN-100844' },
    { id: 210, accession_number:'ACC-2026-004796', patient_name:'Latha R.',   service_name:'Ultrasound abdomen', mrn:'MRN-100839' },
  ];

  const payments = [
    { id: 901, time:'09:42', visit_no:'V-1043', patient:'Asha Verma',   mode:'upi',  amount:1500, ref:'UPI/4471', is_refund:false },
    { id: 902, time:'09:31', visit_no:'V-1042', patient:'Ravi Kumar',   mode:'card', amount:6500, ref:'XXXX-2231', is_refund:false },
    { id: 903, time:'09:12', visit_no:'V-1041', patient:'Sunita Patil', mode:'cash', amount:1300, ref:'',          is_refund:false },
    { id: 904, time:'08:58', visit_no:'V-1039', patient:'Imran Sheikh', mode:'cash', amount:7800, ref:'',          is_refund:false },
    { id: 905, time:'08:40', visit_no:'V-1037', patient:'Priya Nair',   mode:'upi',  amount:450,  ref:'UPI/4460',  is_refund:false },
    { id: 906, time:'08:22', visit_no:'V-1034', patient:'Mohan Das',    mode:'card', amount:3500, ref:'XXXX-0098', is_refund:false },
    { id: 907, time:'08:05', visit_no:'V-1029', patient:'Latha R.',     mode:'cash', amount:600,  ref:'refund',    is_refund:true },
  ];

  const daybook = {
    from:'2026-06-03', to:'2026-06-03', total:48250, count:23, refunds:600,
    by_mode:{ cash:18900, upi:13850, card:14900, other:600 },
  };

  const commissionRows = [
    { referring_doctor_id:1, name:'Dr. Meena Iyer',  clinic:'Iyer Womens Clinic',  total:'4820', entries:18, status:'pending' },
    { referring_doctor_id:2, name:'Dr. S. Raghavan', clinic:'Raghavan Polyclinic', total:'3960', entries:14, status:'pending' },
    { referring_doctor_id:3, name:'Dr. Anil Kapoor', clinic:'City Care Hospital',  total:'2250', entries:15, status:'paid'    },
    { referring_doctor_id:4, name:'Dr. Farah Khan',  clinic:'Sunrise Diagnostics', total:'1680', entries:9,  status:'pending' },
  ];

  const statement = [
    { id:1, order_id:201, accession:'ACC-2026-004812', service:'Ultrasound obstetric', base_amount:'1500', rate_type:'percent', rate_value:'10', commission_amount:'150', period_ym:'2026-06' },
    { id:2, order_id:204, accession:'ACC-2026-004807', service:'Ultrasound pelvis',    base_amount:'1300', rate_type:'percent', rate_value:'10', commission_amount:'130', period_ym:'2026-06' },
    { id:3, order_id:198, accession:'ACC-2026-004788', service:'Ultrasound abdomen',   base_amount:'1200', rate_type:'percent', rate_value:'10', commission_amount:'120', period_ym:'2026-06' },
  ];

  const network = {
    lan_ips: ['192.168.1.20', '10.0.0.20'],
    php_port: 8080,
    client_urls: ['http://192.168.1.20:8080', 'http://oneclickz-ris.local:8080'],
    modality: { server_ip:'192.168.1.20', ae_title:'ONECLICKZ', dicom_port:104, rest_port:8042 },
  };

  const consoles = [
    { id:1, name:'US Room 1 — GE Voluson',  ae_title:'US_VOLUSON', ip:'192.168.1.31', modality:'US', status:'online',  last_seen:'now' },
    { id:2, name:'CT Console — Siemens',    ae_title:'CT_SOMATOM',  ip:'192.168.1.32', modality:'CT', status:'online',  last_seen:'now' },
    { id:3, name:'MR Suite — Philips',      ae_title:'MR_INGENIA',  ip:'192.168.1.33', modality:'MR', status:'online',  last_seen:'2m ago' },
    { id:4, name:'Reception PC 2',          ae_title:'—',           ip:'192.168.1.45', modality:'—',  status:'online',  last_seen:'now' },
    { id:5, name:'X-Ray DR Panel',          ae_title:'XR_DRPANEL',  ip:'192.168.1.34', modality:'XR', status:'offline', last_seen:'1h ago' },
  ];

  return { services, referringDoctors, patients, worklist, collection, payments, daybook, commissionRows, statement, network, consoles };
})();

window.money = (n) => '₹' + Number(n).toLocaleString('en-IN');
