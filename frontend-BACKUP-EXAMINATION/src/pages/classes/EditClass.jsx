import { useEffect, useState } from "react";
import { useNavigate,useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";


function EditClass(){


const {id}=useParams();

const navigate=useNavigate();


const [loading,setLoading]=useState(true);

const [saving,setSaving]=useState(false);



const [form,setForm]=useState({

class_name:"",
level:"",
status:"Active"

});









useEffect(()=>{

loadClass();

},[]);









const loadClass=async()=>{


const {data,error}=await supabase

.from("classes")

.select("*")

.eq("id",id)

.single();





if(error){

console.log(error);

return;

}



setForm({

class_name:data.class_name || "",

level:data.level || "",

status:data.status || "Active"

});


setLoading(false);



};









const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};









const updateClass=async(e)=>{


e.preventDefault();


setSaving(true);





const {error}=await supabase

.from("classes")

.update(form)

.eq("id",id);






if(error){

alert(error.message);

setSaving(false);

return;

}



navigate("/classes");



};









if(loading){

return(

<div className="p-6">

Loading...

</div>

);

}









return(

<div className="p-6">



<h1 className="text-3xl font-bold">

Edit Class

</h1>






<form

onSubmit={updateClass}

className="bg-white shadow rounded-xl p-6 mt-6"

>



<div className="grid md:grid-cols-2 gap-5">



<input

name="class_name"

value={form.class_name}

onChange={handleChange}

className="border p-3 rounded"

required

/>







<input

name="level"

value={form.level}

onChange={handleChange}

className="border p-3 rounded"

/>







<select

name="status"

value={form.status}

onChange={handleChange}

className="border p-3 rounded"

>


<option value="Active">

Active

</option>


<option value="Inactive">

Inactive

</option>



</select>





</div>








<div className="mt-6 flex gap-4">



<button

disabled={saving}

className="bg-blue-600 text-white px-6 py-3 rounded"

>

{

saving ? "Updating..." : "Update Class"

}

</button>






<button

type="button"

onClick={()=>navigate("/classes")}

className="bg-gray-500 text-white px-6 py-3 rounded"

>

Cancel

</button>





</div>







</form>





</div>

);



}



export default EditClass;