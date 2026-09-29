import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function ExamSubjects(){

const { examId } = useParams();

const navigate = useNavigate();


const [subjects,setSubjects] = useState([]);
const [classes,setClasses] = useState([]);

const [examSubjects,setExamSubjects] = useState([]);

const [loading,setLoading] = useState(true);



const [form,setForm] = useState({

subject_id:"",
class_id:"",
full_marks:100,
pass_marks:40

});





useEffect(()=>{

loadData();

},[]);





const loadData = async()=>{


setLoading(true);



// GET SUBJECTS

const {data:sub,error:subError}=await supabase

.from("subjects")

.select("id,subject_name")

.order("subject_name");



if(subError){

console.log(subError);

}




setSubjects(sub || []);






// GET CLASSES

const {data:cls,error:clsError}=await supabase

.from("classes")

.select("id,class_name")

.order("class_name");



if(clsError){

console.log(clsError);

}



setClasses(cls || []);





// GET EXAM SUBJECTS


const {data:existing,error}=await supabase

.from("exam_subjects")

.select(`

id,

full_marks,

pass_marks,

subjects(

subject_name

),

classes(

class_name

)

`)

.eq("exam_id",examId)

.order("id",{ascending:false});



if(error){

console.log("EXAM SUBJECT ERROR:",error);

}



setExamSubjects(existing || []);



setLoading(false);



};








const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};









const addSubject=async(e)=>{


e.preventDefault();


const payload={


exam_id:Number(examId),

subject_id:Number(form.subject_id),

class_id:Number(form.class_id),

full_marks:Number(form.full_marks),

pass_marks:Number(form.pass_marks)


};




const {error}=await supabase

.from("exam_subjects")

.insert([payload]);





if(error){

console.log(error);

alert(error.message);

return;

}





alert("Subject added successfully");



setForm({

subject_id:"",
class_id:"",
full_marks:100,
pass_marks:40

});



loadData();



};








if(loading){


return(

<div className="bg-white p-6 rounded-xl shadow">

Loading Exam Subjects...

</div>

);


}








return(


<div className="space-y-6">






<div className="bg-white p-6 rounded-xl shadow">


<div className="flex justify-between">


<div>


<h1 className="text-2xl font-bold">

Exam Subjects

</h1>


<p className="text-gray-500">

Manage subjects attached to this examination

</p>


</div>



<button

onClick={()=>navigate("/examination/list")}

className="bg-gray-600 text-white px-4 py-2 rounded"

>

Back

</button>



</div>


</div>








<div className="bg-white p-6 rounded-xl shadow">


<h2 className="font-bold text-lg mb-4">

Add Subject To Exam

</h2>





<form

onSubmit={addSubject}

className="grid md:grid-cols-4 gap-4"

>





<select

name="subject_id"

value={form.subject_id}

onChange={handleChange}

className="border p-2 rounded"

required

>

<option value="">

Select Subject

</option>


{

subjects.map(s=>(

<option

key={s.id}

value={s.id}

>

{s.subject_name}

</option>


))

}


</select>









<select

name="class_id"

value={form.class_id}

onChange={handleChange}

className="border p-2 rounded"

required

>

<option value="">

Select Class

</option>


{

classes.map(c=>(

<option

key={c.id}

value={c.id}

>

{c.class_name}

</option>


))

}


</select>







<input

type="number"

name="full_marks"

value={form.full_marks}

onChange={handleChange}

className="border p-2 rounded"

/>







<input

type="number"

name="pass_marks"

value={form.pass_marks}

onChange={handleChange}

className="border p-2 rounded"

/>






<button

className="bg-blue-600 text-white rounded px-4"

>

Add Subject

</button>





</form>



</div>









<div className="bg-white rounded-xl shadow overflow-x-auto">


<table className="w-full">


<thead className="bg-gray-100">


<tr>


<th className="p-3">
Subject
</th>


<th className="p-3">
Class
</th>


<th className="p-3">
Full Marks
</th>


<th className="p-3">
Pass Marks
</th>


</tr>


</thead>





<tbody>


{

examSubjects.map(item=>(


<tr

key={item.id}

className="border-t"

>


<td className="p-3">

{item.subjects?.subject_name}

</td>


<td className="p-3">

{item.classes?.class_name}

</td>


<td className="p-3 text-center">

{item.full_marks}

</td>


<td className="p-3 text-center">

{item.pass_marks}

</td>



</tr>


))


}





{

examSubjects.length===0 &&

<tr>

<td

colSpan="4"

className="p-6 text-center text-gray-500"

>

No subjects added yet

</td>

</tr>


}





</tbody>


</table>



</div>







</div>


);


}



export default ExamSubjects;