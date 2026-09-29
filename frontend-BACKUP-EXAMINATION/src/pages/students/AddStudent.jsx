import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AddStudent(){

const navigate = useNavigate();


const [loading,setLoading] = useState(false);

const [message,setMessage] = useState("");

const [classes,setClasses] = useState([]);





const [student,setStudent] = useState({

admission_number:"",

first_name:"",

middle_name:"",

last_name:"",

gender:"",

date_of_birth:"",

current_class_id:"",

academic_year_id:"",

admission_date:"",

student_status:"Active",

address:"",

phone:"",

email:"",

parent_name:"",

parent_phone:"",

parent_email:"",

stream:""

});








useEffect(()=>{

loadClasses();

},[]);









const loadClasses = async()=>{


const {

data,

error

}= await supabase

.from("classes")

.select("id,class_name")

.order("class_name");



console.log(
"CLASSES:",
data
);


console.log(
"CLASS ERROR:",
error
);



if(data){

setClasses(data);

}



};









const handleChange=(e)=>{


const {

name,

value

}=e.target;



setStudent({

...student,

[name]:value

});


};









const saveStudent = async(e)=>{


e.preventDefault();


setLoading(true);

setMessage("");






const payload={



admission_number:
student.admission_number,



first_name:
student.first_name,



middle_name:
student.middle_name || null,



last_name:
student.last_name,



gender:
student.gender || null,



date_of_birth:
student.date_of_birth || null,



current_class_id:
student.current_class_id
?
Number(student.current_class_id)
:
null,



academic_year_id:
student.academic_year_id
?
Number(student.academic_year_id)
:
null,



admission_date:
student.admission_date || null,



student_status:
student.student_status,



address:
student.address || null,



phone:
student.phone || null,



email:
student.email || null,



parent_name:
student.parent_name || null,



parent_phone:
student.parent_phone || null,



parent_email:
student.parent_email || null,



stream:
student.stream || null



};






console.log(
"STUDENT PAYLOAD:",
payload
);









const {

data,

error

}= await supabase


.from("students")


.insert([payload])


.select();








console.log(
"STUDENT RESULT:",
data
);



console.log(
"STUDENT ERROR:",
error
);






if(error){


setMessage(error.message);


setLoading(false);


return;


}







setMessage(
"Student added successfully ✅"
);






setTimeout(()=>{


navigate("/students");


},1000);





setLoading(false);


};













return(

<div className="p-6">



<h1 className="text-3xl font-bold">

Add New Student

</h1>





<form

onSubmit={saveStudent}

className="bg-white shadow rounded-xl p-6 mt-6"

>



<div className="grid md:grid-cols-2 gap-5">





<input

name="admission_number"

placeholder="Admission Number"

value={student.admission_number}

onChange={handleChange}

required

className="border p-3 rounded-lg"

/>






<input

name="first_name"

placeholder="First Name"

value={student.first_name}

onChange={handleChange}

required

className="border p-3 rounded-lg"

/>







<input

name="middle_name"

placeholder="Middle Name"

value={student.middle_name}

onChange={handleChange}

className="border p-3 rounded-lg"

/>







<input

name="last_name"

placeholder="Last Name"

value={student.last_name}

onChange={handleChange}

required

className="border p-3 rounded-lg"

/>








<select

name="gender"

value={student.gender}

onChange={handleChange}

className="border p-3 rounded-lg"

>


<option value="">

Gender

</option>


<option value="Male">

Male

</option>


<option value="Female">

Female

</option>


</select>








<input

type="date"

name="date_of_birth"

value={student.date_of_birth}

onChange={handleChange}

className="border p-3 rounded-lg"

/>







<select

name="current_class_id"

value={student.current_class_id}

onChange={handleChange}

className="border p-3 rounded-lg"

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

placeholder="Parent Name"

value={student.parent_name}

onChange={handleChange}

className="border p-3 rounded-lg"

/>






<input

name="parent_phone"

placeholder="Parent Phone"

value={student.parent_phone}

onChange={handleChange}

className="border p-3 rounded-lg"

/>






<input

name="phone"

placeholder="Student Phone"

value={student.phone}

onChange={handleChange}

className="border p-3 rounded-lg"

/>







<input

name="email"

placeholder="Email"

value={student.email}

onChange={handleChange}

className="border p-3 rounded-lg"

/>





</div>









{

message &&

<div className="mt-5 bg-gray-100 p-3 rounded">

{message}

</div>

}








<div className="mt-6 flex gap-4">


<button

disabled={loading}

className="bg-blue-600 text-white px-6 py-3 rounded-lg"

>


{

loading

?

"Saving..."

:

"Save Student"

}


</button>







<button

type="button"

onClick={()=>navigate("/students")}

className="bg-gray-500 text-white px-6 py-3 rounded-lg"

>

Back

</button>



</div>







</form>



</div>

);


}



export default AddStudent;