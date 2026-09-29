import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AddSubject(){

const navigate = useNavigate();


const [loading,setLoading] = useState(false);

const [message,setMessage] = useState("");

const [curriculums,setCurriculums] = useState([]);





const [subject,setSubject] = useState({

curriculum_id:"",

subject_name:"",

subject_code:"",

education_level:"",

class_scope:"",

is_compulsory:true,

is_active:true,

effective_from_year:"",

effective_to_year:""

});








useEffect(()=>{

loadCurriculums();

},[]);








const loadCurriculums = async()=>{


const {

data,

error

}= await supabase

.from("curriculums")

.select("id,curriculum_name")

.order("curriculum_name");





console.log(
"CURRICULUMS:",
data
);


console.log(
"CURRICULUM ERROR:",
error
);




if(data){

setCurriculums(data);

}



};










const handleChange=(e)=>{


const {

name,

value,

type,

checked

}=e.target;




setSubject({

...subject,


[name]:

type==="checkbox"

?

checked

:

value


});



};









const saveSubject = async(e)=>{


e.preventDefault();


setLoading(true);

setMessage("");






const payload={


curriculum_id:

subject.curriculum_id

?

Number(subject.curriculum_id)

:

null,



subject_name:

subject.subject_name.trim(),



subject_code:

subject.subject_code.trim() || null,



education_level:

subject.education_level,



class_scope:

subject.class_scope.trim() || null,



is_compulsory:

subject.is_compulsory,



is_active:

subject.is_active,



effective_from_year:

subject.effective_from_year

?

Number(subject.effective_from_year)

:

null,



effective_to_year:

subject.effective_to_year

?

Number(subject.effective_to_year)

:

null



};






console.log(
"SUBJECT PAYLOAD:",
payload
);








const {

data,

error

}= await supabase


.from("subjects")


.insert([payload])


.select();








console.log(
"SUBJECT RESULT:",
data
);



console.log(
"SUBJECT ERROR:",
error
);







if(error){


setMessage(error.message);


setLoading(false);


return;


}







setMessage(
"Subject added successfully ✅"
);






setTimeout(()=>{


navigate("/subjects");


},1000);





setLoading(false);



};













return(

<div className="p-6">



<h1 className="text-3xl font-bold text-gray-800">

Add New Subject

</h1>




<p className="text-gray-600 mt-2">

Create subject in AfriCore ERP PRO

</p>






<form

onSubmit={saveSubject}

className="bg-white shadow rounded-xl p-6 mt-6"

>





<div className="grid md:grid-cols-2 gap-5">





<div>

<label className="block mb-2 font-medium">

Curriculum

</label>


<select

name="curriculum_id"

value={subject.curriculum_id}

onChange={handleChange}

className="w-full border p-3 rounded-lg"

>


<option value="">

Select Curriculum (Optional)

</option>



{

curriculums.map((item)=>(

<option

key={item.id}

value={item.id}

>

{item.curriculum_name}

</option>

))

}



</select>


</div>









<div>

<label className="block mb-2 font-medium">

Subject Name

</label>


<input

name="subject_name"

value={subject.subject_name}

onChange={handleChange}

required

placeholder="Mathematics"

className="w-full border p-3 rounded-lg"

/>


</div>









<div>

<label className="block mb-2 font-medium">

Subject Code

</label>


<input

name="subject_code"

value={subject.subject_code}

onChange={handleChange}

placeholder="MATH"

className="w-full border p-3 rounded-lg"

/>


</div>









<div>

<label className="block mb-2 font-medium">

Education Level

</label>


<select

name="education_level"

value={subject.education_level}

onChange={handleChange}

required

className="w-full border p-3 rounded-lg"

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


</div>









<div>

<label className="block mb-2 font-medium">

Class Scope

</label>


<input

name="class_scope"

value={subject.class_scope}

onChange={handleChange}

placeholder="Form I-IV"

className="w-full border p-3 rounded-lg"

/>


</div>









<div>

<label className="block mb-2 font-medium">

Effective From Year

</label>


<input

type="number"

name="effective_from_year"

value={subject.effective_from_year}

onChange={handleChange}

placeholder="2026"

className="w-full border p-3 rounded-lg"

/>


</div>









<div>

<label className="block mb-2 font-medium">

Effective To Year

</label>


<input

type="number"

name="effective_to_year"

value={subject.effective_to_year}

onChange={handleChange}

placeholder="2030"

className="w-full border p-3 rounded-lg"

/>


</div>



</div>









<div className="flex gap-6 mt-6">


<label>

<input

type="checkbox"

name="is_compulsory"

checked={subject.is_compulsory}

onChange={handleChange}

/>

{" "}Compulsory Subject

</label>





<label>

<input

type="checkbox"

name="is_active"

checked={subject.is_active}

onChange={handleChange}

/>

{" "}Active

</label>


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

className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"

>


{

loading

?

"Saving..."

:

"Save Subject"

}


</button>







<button

type="button"

onClick={()=>navigate("/subjects")}

className="bg-gray-500 text-white px-6 py-3 rounded-lg"

>

Back

</button>






</div>






</form>






</div>

);

}




export default AddSubject;