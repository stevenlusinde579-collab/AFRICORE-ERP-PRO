import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";


function EditAssignment(){


const {id}=useParams();

const navigate=useNavigate();


const [teachers,setTeachers]=useState([]);

const [subjects,setSubjects]=useState([]);

const [classes,setClasses]=useState([]);


const [loading,setLoading]=useState(true);

const [saving,setSaving]=useState(false);

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


const {data:assignment,error}=await supabase

.from("teacher_assignments")

.select("*")

.eq("id",id)

.single();







if(error){

console.log(error.message);

return;

}







const {data:teacherData}=await supabase

.from("teachers")

.select("*")

.order("first_name");







const {data:subjectData}=await supabase

.from("subjects")

.select("*")

.order("subject_name");







const {data:classData}=await supabase

.from("classes")

.select("*")

.order("class_name");








setTeachers(teacherData || []);

setSubjects(subjectData || []);

setClasses(classData || []);






setForm({

teacher_id:assignment.teacher_id,

subject_id:assignment.subject_id,

class_id:assignment.class_id

});






setLoading(false);



};









const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};









const updateAssignment=async(e)=>{


e.preventDefault();


setSaving(true);

setMessage("");







const {error}=await supabase

.from("teacher_assignments")

.update(form)

.eq("id",id);







if(error){


console.log("UPDATE ERROR:",error);


setMessage(error.message);


setSaving(false);


return;


}







setMessage(

"Assignment updated successfully ✅"

);






setTimeout(()=>{


navigate("/teacher-assignment");


},1000);





};









if(loading){

return(

<div className="p-6">

Loading assignment...

</div>

);

}









return(

<div className="p-6">






<h1 className="text-3xl font-bold text-gray-800">

Edit Teacher Assignment

</h1>









<form

onSubmit={updateAssignment}

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

subjects.map((item)=>(


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

disabled={saving}

className="bg-blue-600 text-white px-6 py-3 rounded-lg"

>


{

saving

?

"Updating..."

:

"Update Assignment"

}


</button>








<button

type="button"

onClick={()=>navigate("/teacher-assignment")}

className="bg-gray-500 text-white px-6 py-3 rounded-lg"

>

Cancel

</button>






</div>









</form>








</div>

);


}



export default EditAssignment;