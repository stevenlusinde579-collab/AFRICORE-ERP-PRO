import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";


function EditSubject(){


const {id}=useParams();

const navigate=useNavigate();



const [loading,setLoading]=useState(true);



const [form,setForm]=useState({

subject_name:"",
subject_code:"",
education_level:"",
is_compulsory:true,
is_active:true,
effective_from_year:"",
effective_to_year:"",
class_scope:""

});







const loadSubject=async()=>{


const {data,error}=await supabase

.from("subjects")

.select("*")

.eq("id",id)

.single();





if(error){

console.log(error);

alert(error.message);

return;

}





setForm({

subject_name:data.subject_name || "",

subject_code:data.subject_code || "",

education_level:data.education_level || "",

is_compulsory:data.is_compulsory,

is_active:data.is_active,

effective_from_year:data.effective_from_year || "",

effective_to_year:data.effective_to_year || "",

class_scope:data.class_scope || ""

});



setLoading(false);



};







useEffect(()=>{


loadSubject();


},[]);









const handleChange=(e)=>{


const {name,value,type,checked}=e.target;


setForm({

...form,

[name]:

type==="checkbox"

?

checked

:

value


});


};








const updateSubject=async()=>{



const {error}=await supabase

.from("subjects")

.update({

subject_name:form.subject_name,

subject_code:form.subject_code,

education_level:form.education_level,

is_compulsory:form.is_compulsory,

is_active:form.is_active,

effective_from_year:

form.effective_from_year || null,


effective_to_year:

form.effective_to_year || null,


class_scope:form.class_scope


})

.eq("id",id);






if(error){

alert(error.message);

return;

}




alert("Subject updated successfully");


navigate("/subjects");



};







if(loading){

return (

<div className="p-6">

Loading...

</div>

);

}







return(


<div className="bg-white shadow rounded-xl p-6">



<h1 className="text-2xl font-bold mb-6">

Edit Subject

</h1>






<div className="grid grid-cols-1 md:grid-cols-2 gap-5">





<input

name="subject_name"

value={form.subject_name}

onChange={handleChange}

className="border p-3 rounded-lg"

placeholder="Subject Name"

/>





<input

name="subject_code"

value={form.subject_code}

onChange={handleChange}

className="border p-3 rounded-lg"

placeholder="Subject Code"

/>







<select

name="education_level"

value={form.education_level}

onChange={handleChange}

className="border p-3 rounded-lg"

>


<option value="">

Select Level

</option>


<option value="Primary">

Primary

</option>


<option value="Secondary">

Secondary

</option>


<option value="Advanced">

Advanced

</option>


</select>








<input

name="class_scope"

value={form.class_scope}

onChange={handleChange}

className="border p-3 rounded-lg"

placeholder="Class Scope"

/>







<input

type="number"

name="effective_from_year"

value={form.effective_from_year}

onChange={handleChange}

className="border p-3 rounded-lg"

placeholder="Effective From Year"

/>







<input

type="number"

name="effective_to_year"

value={form.effective_to_year}

onChange={handleChange}

className="border p-3 rounded-lg"

placeholder="Effective To Year"

/>



</div>









<div className="mt-5 space-y-3">



<label className="flex gap-3 items-center">

<input

type="checkbox"

name="is_compulsory"

checked={form.is_compulsory}

onChange={handleChange}

/>

Compulsory Subject

</label>






<label className="flex gap-3 items-center">

<input

type="checkbox"

name="is_active"

checked={form.is_active}

onChange={handleChange}

/>

Active Subject

</label>



</div>









<div className="mt-6 flex gap-3">



<button

onClick={updateSubject}

className="bg-blue-600 text-white px-6 py-3 rounded-lg"

>

Update Subject

</button>





<button

onClick={()=>navigate("/subjects")}

className="bg-gray-600 text-white px-6 py-3 rounded-lg"

>

Cancel

</button>



</div>






</div>


);


}



export default EditSubject;