import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function EditStudent(){


const {id}=useParams();

const navigate=useNavigate();


const [student,setStudent]=useState(null);

const [classes,setClasses]=useState([]);

const [loading,setLoading]=useState(true);

const [message,setMessage]=useState("");





useEffect(()=>{

loadStudent();

loadClasses();

},[]);







const loadStudent=async()=>{


const {data,error}=await supabase

.from("students")

.select("*")

.eq("id",id)

.single();



if(error){

console.log(error);

}else{

setStudent(data);

}


setLoading(false);


};









const loadClasses=async()=>{


const {data,error}=await supabase

.from("classes")

.select("id,class_name")

.order("class_name");



if(error){

console.log(error);

}else{

setClasses(data || []);

}


};









const handleChange=(e)=>{


setStudent({

...student,

[e.target.name]:e.target.value

});


};









const updateStudent=async(e)=>{


e.preventDefault();


const selectedClass=classes.find(

(item)=>item.id===Number(student.current_class_id)

);





const {error}=await supabase

.from("students")

.update({

...student,

current_class_id:Number(student.current_class_id),

class_name:selectedClass?.class_name || ""

})

.eq("id",id);





if(error){

setMessage(error.message);

return;

}





setMessage("Student updated successfully ✅");



setTimeout(()=>{

navigate("/students");

},1000);



};









if(loading){

return <div className="p-6">

Loading...

</div>

}





return (

<div className="p-6">



<h1 className="text-3xl font-bold mb-6">

Edit Student

</h1>






<form

onSubmit={updateStudent}

className="bg-white shadow rounded-xl p-6"

>




<div className="grid md:grid-cols-2 gap-5">





<input

name="admission_number"

value={student.admission_number || ""}

onChange={handleChange}

className="border p-3 rounded"

/>







<input

name="first_name"

value={student.first_name || ""}

onChange={handleChange}

className="border p-3 rounded"

/>







<input

name="middle_name"

value={student.middle_name || ""}

onChange={handleChange}

className="border p-3 rounded"

/>







<input

name="last_name"

value={student.last_name || ""}

onChange={handleChange}

className="border p-3 rounded"

/>







<select

name="gender"

value={student.gender || ""}

onChange={handleChange}

className="border p-3 rounded"

>


<option value="">

Select Gender

</option>


<option value="Male">

Male

</option>


<option value="Female">

Female

</option>


</select>







<select

name="current_class_id"

value={student.current_class_id || ""}

onChange={handleChange}

className="border p-3 rounded"

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







<input

name="parent_name"

value={student.parent_name || ""}

onChange={handleChange}

className="border p-3 rounded"

/>







<input

name="parent_phone"

value={student.parent_phone || ""}

onChange={handleChange}

className="border p-3 rounded"

/>






</div>






{

message &&

<div className="mt-5 p-3 bg-gray-100">

{message}

</div>

}







<div className="mt-6 flex gap-4">



<button

className="bg-blue-600 text-white px-6 py-3 rounded"

>

Update Student

</button>





<button

type="button"

onClick={()=>navigate("/students")}

className="bg-gray-500 text-white px-6 py-3 rounded"

>

Cancel

</button>



</div>






</form>



</div>

);



}


export default EditStudent;