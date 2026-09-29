import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";


function EditTimetable(){

const {id}=useParams();

const navigate=useNavigate();


const [classes,setClasses]=useState([]);
const [streams,setStreams]=useState([]);
const [subjects,setSubjects]=useState([]);
const [teachers,setTeachers]=useState([]);

const [loading,setLoading]=useState(false);

const [message,setMessage]=useState("");




const [form,setForm]=useState({

day_name:"",

class_id:"",

stream_id:"",

subject_id:"",

teacher_id:"",

period_id:"",

start_time:"",

end_time:"",

session:""

});







useEffect(()=>{

loadData();

},[]);









const loadData=async()=>{


// LOAD TIMETABLE


const {data:item,error}=await supabase

.from("class_timetables")

.select("*")

.eq("id",id)

.single();





if(error){

console.log(error);

return;

}







setForm({

day_name:item.day_name || "",

class_id:item.class_id || "",

stream_id:item.stream_id || "",

subject_id:item.subject_id || "",

teacher_id:item.teacher_id || "",

period_id:item.period_id || "",

start_time:item.start_time || "",

end_time:item.end_time || "",

session:item.session || "Morning"

});







// CLASSES

const {data:classData}=await supabase

.from("classes")

.select("*")

.order("class_name");





setClasses(classData || []);







// STREAMS

const {data:streamData}=await supabase

.from("streams")

.select("*")

.order("stream_name");




setStreams(streamData || []);







// SUBJECTS


const {data:subjectData}=await supabase

.from("subjects")

.select("*")

.order("subject_name");



setSubjects(subjectData || []);







// TEACHERS


const {data:teacherData}=await supabase

.from("teachers")

.select("*")

.order("first_name");



setTeachers(teacherData || []);



};









const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};











const updateTimetable=async(e)=>{


e.preventDefault();


setLoading(true);

setMessage("");







const {error}=await supabase

.from("class_timetables")

.update({


day_name:form.day_name,


class_id:Number(form.class_id),


stream_id:Number(form.stream_id),


subject_id:Number(form.subject_id),


teacher_id:Number(form.teacher_id),


period_id:Number(form.period_id),


start_time:form.start_time,


end_time:form.end_time,


session:form.session



})

.eq("id",id);








if(error){


console.log(error);


setMessage(error.message);


setLoading(false);


return;


}







setMessage(

"Timetable updated successfully ✅"

);







setTimeout(()=>{


navigate("/timetable");


},1000);




};









return(

<div className="p-6">


<h1 className="text-3xl font-bold mb-5">

Edit Timetable

</h1>








<form

onSubmit={updateTimetable}

className="bg-white shadow rounded-xl p-6"

>







<div className="grid md:grid-cols-2 gap-5">







<select

name="day_name"

value={form.day_name}

onChange={handleChange}

className="border p-3 rounded"

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

className="border p-3 rounded"

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

name="stream_id"

value={form.stream_id}

onChange={handleChange}

className="border p-3 rounded"

>


<option value="">

Select Stream

</option>




{

streams

.filter(s=>

Number(s.class_id)===Number(form.class_id)

)

.map(s=>(


<option

key={s.id}

value={s.id}

>


Stream {s.stream_name}


</option>


))


}



</select>









<select

name="subject_id"

value={form.subject_id}

onChange={handleChange}

className="border p-3 rounded"

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

className="border p-3 rounded"

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


{t.first_name}

{" "}

{t.last_name}


</option>


))


}


</select>










<input

type="number"

name="period_id"

value={form.period_id}

onChange={handleChange}

className="border p-3 rounded"

placeholder="Period Number"

/>









<select

name="session"

value={form.session}

onChange={handleChange}

className="border p-3 rounded"

>


<option>

Morning

</option>


<option>

Evening

</option>


<option>

Break

</option>


<option>

Lunch

</option>


</select>










<input

type="time"

name="start_time"

value={form.start_time}

onChange={handleChange}

className="border p-3 rounded"

/>








<input

type="time"

name="end_time"

value={form.end_time}

onChange={handleChange}

className="border p-3 rounded"

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

className="bg-blue-600 text-white px-6 py-3 rounded"

>


{

loading ?

"Updating..."

:

"Update Timetable"

}


</button>







<button

type="button"

onClick={()=>navigate("/timetable")}

className="bg-gray-500 text-white px-6 py-3 rounded"

>

Back

</button>



</div>








</form>





</div>


);


}



export default EditTimetable;