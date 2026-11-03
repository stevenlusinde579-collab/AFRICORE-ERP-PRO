import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AssignmentForm(){


const navigate = useNavigate();


const [teachers,setTeachers]=useState([]);

const [subjects,setSubjects]=useState([]);
const [classSubjectIds,setClassSubjectIds]=useState(null);

const [classes,setClasses]=useState([]);


const [loading,setLoading]=useState(false);


const [message,setMessage]=useState("");






const [form,setForm]=useState({

teacher_id:"",

subject_id:"",

class_id:""

});









useEffect(()=>{


loadData();


},[]);









const loadData=async()=>{



const {data:teacherData}=await supabase

.from("teachers")

.select("*")

.order("first_name");



const {data:subjectData}=await supabase

.from("subjects")

.select("*")

.eq("is_active", true)

.order("subject_name");



const {data:classData}=await supabase

.from("classes")

.select("*")

.eq("is_active", true)

.order("class_name");






setTeachers(teacherData || []);

setSubjects(subjectData || []);

setClasses(classData || []);





};









const handleChange=async(e)=>{

const { name, value } = e.target;

setForm(previous => ({
    ...previous,
    [name]: value,
    ...(name === "class_id" ? { subject_id: "" } : {})
}));

if (name === "class_id") {
    setClassSubjectIds(null);
    if (!value) return;

    const { data: links, error } = await supabase
        .from("class_subjects")
        .select("subject_id, is_active")
        .eq("class_id", Number(value));

    if (error) {
        setClassSubjectIds([]);
        setMessage(error.message);
        return;
    }

    // Keep legacy classes usable until their subject list is configured.
    setClassSubjectIds(
        (links || []).length === 0
            ? null
            : (links || [])
                .filter(link => link.is_active === true)
                .map(link => Number(link.subject_id))
    );
}

};









const visibleSubjects = classSubjectIds === null
    ? subjects
    : subjects.filter(item => classSubjectIds.includes(Number(item.id)));

const saveAssignment=async(e)=>{


e.preventDefault();


setLoading(true);

setMessage("");







const {error}=await supabase

.from("teacher_assignments")

.insert([form]);







if(error){


console.log("ASSIGNMENT ERROR:",error);


setMessage(error.message);


setLoading(false);


return;


}







setMessage(

"Assignment saved successfully ✅"

);







setTimeout(()=>{


navigate("/teacher-assignment");


},1000);





};









return (

<div className="p-6">






<h1 className="text-3xl font-bold text-gray-800">

Add Teacher Assignment

</h1>








<form

onSubmit={saveAssignment}

className="bg-white shadow rounded-xl p-6 mt-6"

>







<div className="grid md:grid-cols-3 gap-5">






<select

name="teacher_id"

value={form.teacher_id}

onChange={handleChange}

className="border p-3 rounded-lg"

required

>


<option value="">

Select Teacher

</option>



{

teachers.map((item)=>(


<option

key={item.id}

value={item.id}

>

{item.first_name} {item.last_name}

</option>


))

}



</select>









<select

name="subject_id"

value={form.subject_id}

onChange={handleChange}

className="border p-3 rounded-lg"

required

>



<option value="">

Select Subject

</option>



{

visibleSubjects.map((item)=>(



<option

key={item.id}

value={item.id}

>

{item.subject_name}

</option>


))

}



</select>









<select

name="class_id"

value={form.class_id}

onChange={handleChange}

className="border p-3 rounded-lg"

required

>



<option value="">

Select Class

</option>



{

classes.map((item)=>(


<option

key={item.id}

value={item.id}

>

{item.class_name}

</option>


))

}



</select>







</div>









{

message &&

<div className="mt-5 bg-gray-100 p-3 rounded">

{message}

</div>

}









<div className="flex gap-4 mt-6">






<button

disabled={loading}

className="bg-blue-600 text-white px-6 py-3 rounded-lg"

>


{

loading

?

"Saving..."

:

"Save Assignment"

}


</button>








<button

type="button"

onClick={()=>navigate("/teacher-assignment")}

className="bg-gray-500 text-white px-6 py-3 rounded-lg"

>

Back

</button>






</div>









</form>






</div>

);


}



export default AssignmentForm;