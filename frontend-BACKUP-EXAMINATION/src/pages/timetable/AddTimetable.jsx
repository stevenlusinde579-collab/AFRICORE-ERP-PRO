import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AddTimetable(){

const navigate = useNavigate();


const schoolId = 1;


const [classes,setClasses]=useState([]);
const [subjects,setSubjects]=useState([]);
const [teachers,setTeachers]=useState([]);


const [loading,setLoading]=useState(false);
const [message,setMessage]=useState("");





const [form,setForm]=useState({

day_name:"Monday",

class_id:"",

subject_id:"",

teacher_id:"",

period_id:"",

start_time:"",

end_time:"",

session:"Morning"

});









useEffect(()=>{

loadData();

},[]);









const loadData=async()=>{


const {data:classData}=await supabase

.from("classes")

.select("*")

.order("class_name");




const {data:subjectData}=await supabase

.from("subjects")

.select("*")

.order("subject_name");




const {data:teacherData}=await supabase

.from("teachers")

.select("*")

.order("first_name");




setClasses(classData || []);

setSubjects(subjectData || []);

setTeachers(teacherData || []);


};









const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};











// ================= SAVE TIMETABLE =================


const saveTimetable=async(e)=>{


e.preventDefault();


setLoading(true);

setMessage("");





// CHECK EXISTING DATA


const {data:existing,error:checkError}=await supabase

.from("class_timetables")

.select("*")

.eq("class_id",Number(form.class_id))

.eq("period_id",Number(form.period_id))

.eq("day_name",form.day_name);







if(checkError){


setMessage(checkError.message);

setLoading(false);

return;


}







// CHECK SAME SUBJECT


const sameSubject=existing?.find(item=>

item.subject_id===Number(form.subject_id)

);





if(sameSubject){


setMessage(

"This subject already exists in this class period"

);


setLoading(false);

return;


}









// CHECK TEACHER CONFLICT


const {data:teacherBusy}=await supabase

.from("class_timetables")

.select("*")

.eq("teacher_id",Number(form.teacher_id))

.eq("period_id",Number(form.period_id))

.eq("day_name",form.day_name);







if(teacherBusy && teacherBusy.length>0){


setMessage(

"This teacher is already assigned another class at this time"

);


setLoading(false);

return;


}










// INSERT


const {error}=await supabase

.from("class_timetables")

.insert([


{


school_id:schoolId,


class_id:Number(form.class_id),


subject_id:Number(form.subject_id),


teacher_id:Number(form.teacher_id),


period_id:Number(form.period_id),


day_name:form.day_name,


start_time:form.start_time,


end_time:form.end_time,


session:form.session



}


]);










if(error){


console.log(error);


setMessage(

error.message

);


setLoading(false);


return;


}







setMessage(

"Timetable saved successfully ✅"

);







setForm({

day_name:"Monday",

class_id:"",

subject_id:"",

teacher_id:"",

period_id:"",

start_time:"",

end_time:"",

session:"Morning"

});




setLoading(false);



};











return(


<div className="p-6">





<h1 className="text-3xl font-bold">

Add Timetable

</h1>



<p className="text-gray-600 mt-2 mb-6">

Create timetable with multiple subjects in same period

</p>








<form

onSubmit={saveTimetable}

className="bg-white shadow rounded-xl p-6"

>





<div className="grid md:grid-cols-2 gap-5">







<select

name="day_name"

value={form.day_name}

onChange={handleChange}

className="border p-3 rounded-lg"

>


<option>Monday</option>

<option>Tuesday</option>

<option>Wednesday</option>

<option>Thursday</option>

<option>Friday</option>


</select>









<select

name="class_id"

value={form.class_id}

onChange={handleChange}

required

className="border p-3 rounded-lg"

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









<select

name="subject_id"

value={form.subject_id}

onChange={handleChange}

required

className="border p-3 rounded-lg"

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

name="teacher_id"

value={form.teacher_id}

onChange={handleChange}

required

className="border p-3 rounded-lg"

>


<option value="">

Select Teacher

</option>




{

teachers.map(t=>(


<option

key={t.id}

value={t.id}

>

{t.first_name} {t.last_name}

</option>


))


}



</select>









<input

type="number"

name="period_id"

placeholder="Period Number"

value={form.period_id}

onChange={handleChange}

required

className="border p-3 rounded-lg"

/>








<select

name="session"

value={form.session}

onChange={handleChange}

className="border p-3 rounded-lg"

>


<option value="Morning">

Morning

</option>


<option value="Evening">

Evening

</option>


</select>









<div>

<label>

Start Time

</label>


<input

type="time"

name="start_time"

value={form.start_time}

onChange={handleChange}

required

className="border p-3 rounded-lg w-full"

/>


</div>









<div>

<label>

End Time

</label>


<input

type="time"

name="end_time"

value={form.end_time}

onChange={handleChange}

required

className="border p-3 rounded-lg w-full"

/>


</div>








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

loading ?

"Saving..."

:

"Save Timetable"

}



</button>








<button

type="button"

onClick={()=>navigate("/timetable")}

className="bg-gray-500 text-white px-6 py-3 rounded-lg"

>


Back


</button>



</div>







</form>






</div>


);


}



export default AddTimetable;