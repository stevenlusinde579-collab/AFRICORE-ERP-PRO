import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AddExamSubject(){


const {examId}=useParams();

const navigate=useNavigate();


const [subjects,setSubjects]=useState([]);

const [classes,setClasses]=useState([]);

const [loading,setLoading]=useState(false);



const [form,setForm]=useState({

subject_id:"",
class_id:"",
full_marks:100,
pass_marks:40,
test_1_max:"",
test_2_max:"",
practical_max:""

});





useEffect(()=>{

loadData();

},[]);







const loadData=async()=>{


const {data:subjectData}=await supabase

.from("subjects")

.select("*")

.order("subject_name");



const {data:classData}=await supabase

.from("classes")

.select("*")

.order("class_name");



setSubjects(subjectData || []);

setClasses(classData || []);



};









const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};









const saveSubject=async(e)=>{


e.preventDefault();


setLoading(true);



const {error}=await supabase

.from("exam_subjects")

.insert([

{

exam_id:examId,

subject_id:form.subject_id,

class_id:form.class_id,

full_marks:Number(form.full_marks),

pass_marks:Number(form.pass_marks),
assessment_components:[
{key:"test_1",label:"Test 1",type:"test",max_marks:Number(form.test_1_max)},
{key:"test_2",label:"Test 2",type:"test",max_marks:Number(form.test_2_max)},
{key:"practical",label:"Practical",type:"practical",max_marks:Number(form.practical_max)}
].filter(item=>item.max_marks>0)

}

]);





if(error){

alert(error.message);

setLoading(false);

return;

}



alert("Subject added successfully");


navigate(`/examination/${examId}/subjects`);


};









return(

<div className="bg-white p-6 rounded-xl shadow max-w-xl">


<h1 className="text-xl font-bold mb-5">

Add Exam Subject

</h1>



<form

onSubmit={saveSubject}

className="space-y-4"

>



<div>

<label>Subject</label>


<select

name="subject_id"

onChange={handleChange}

className="w-full border p-3 rounded"

required

>


<option>

Select Subject

</option>


{

subjects.map(sub=>(


<option

key={sub.id}

value={sub.id}

>

{sub.subject_name}

</option>


))

}


</select>


</div>








<div>

<label>Class</label>


<select

name="class_id"

onChange={handleChange}

className="w-full border p-3 rounded"

required

>


<option>

Select Class

</option>


{

classes.map(cls=>(


<option

key={cls.id}

value={cls.id}

>

{cls.class_name}

</option>


))

}


</select>


</div>









<div>

<label>Full Marks</label>


<input

type="number"

name="full_marks"

value={form.full_marks}

onChange={handleChange}

className="w-full border p-3 rounded"

/>


</div>







<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<label>Test 1 maximum
<input type="number" min="1" step="0.01" name="test_1_max" value={form.test_1_max} onChange={handleChange} className="w-full border p-3 rounded" placeholder="Optional" />
</label>
<label>Test 2 maximum
<input type="number" min="1" step="0.01" name="test_2_max" value={form.test_2_max} onChange={handleChange} className="w-full border p-3 rounded" placeholder="Optional" />
</label>
<label>Practical maximum
<input type="number" min="1" step="0.01" name="practical_max" value={form.practical_max} onChange={handleChange} className="w-full border p-3 rounded" placeholder="Optional" />
</label>
</div>

<div className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded p-3">
Assessment setup ni hiari. Acha fields zote wazi ili kutumia mfumo wa sasa wa kuingiza marks kwa kila swali.
</div>

<div>

<label>Pass Marks</label>


<input

type="number"

name="pass_marks"

value={form.pass_marks}

onChange={handleChange}

className="w-full border p-3 rounded"

/>


</div>







<button

disabled={loading}

className="bg-blue-600 text-white px-5 py-3 rounded"

>


{

loading ?

"Saving..."

:

"Save Subject"

}


</button>



</form>


</div>

);


}


export default AddExamSubject;