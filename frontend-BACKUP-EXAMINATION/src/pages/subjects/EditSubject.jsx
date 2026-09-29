import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";


function EditSubject(){


const {id}=useParams();

const navigate=useNavigate();



const [loading,setLoading]=useState(true);

const [saving,setSaving]=useState(false);

const [message,setMessage]=useState("");




const [subject,setSubject]=useState({

subject_name:"",
subject_code:"",
status:"Active"

});









useEffect(()=>{


loadSubject();


},[]);









const loadSubject=async()=>{


const {data,error}=await supabase

.from("subjects")

.select("*")

.eq("id",id)

.single();






console.log("EDIT SUBJECT:",data);

console.log("ERROR:",error);







if(error){

console.log(error.message);

return;

}





setSubject({

subject_name:data.subject_name || "",

subject_code:data.subject_code || "",

status:data.status || "Active"

});




setLoading(false);



};









const handleChange=(e)=>{


setSubject({

...subject,

[e.target.name]:e.target.value

});


};









const updateSubject=async(e)=>{


e.preventDefault();



setSaving(true);

setMessage("");








const {error}=await supabase

.from("subjects")

.update(subject)

.eq("id",id);







if(error){


console.log("UPDATE ERROR:",error);


setMessage(error.message);


setSaving(false);


return;


}







setMessage(

"Subject updated successfully ✅"

);






setTimeout(()=>{


navigate("/subjects");


},1000);






};









if(loading){

return (

<div className="p-6">

Loading subject...

</div>

);

}









return (

<div className="p-6">





<h1 className="text-3xl font-bold text-gray-800">

Edit Subject

</h1>







<form

onSubmit={updateSubject}

className="bg-white shadow rounded-xl p-6 mt-6"

>







<div className="grid md:grid-cols-2 gap-5">






<input

name="subject_name"

value={subject.subject_name}

onChange={handleChange}

className="border p-3 rounded-lg"

required

/>









<input

name="subject_code"

value={subject.subject_code}

onChange={handleChange}

className="border p-3 rounded-lg"

/>









<select

name="status"

value={subject.status}

onChange={handleChange}

className="border p-3 rounded-lg"

>



<option value="Active">

Active

</option>



<option value="Inactive">

Inactive

</option>



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

"Update Subject"

}


</button>








<button

type="button"

onClick={()=>navigate("/subjects")}

className="bg-gray-500 text-white px-6 py-3 rounded-lg"

>

Cancel

</button>







</div>








</form>









</div>

);



}



export default EditSubject;