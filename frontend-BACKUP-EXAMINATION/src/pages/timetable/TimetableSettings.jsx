import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";


function TimetableSettings(){


const schoolId = 1;


const [form,setForm]=useState({

break_start:"",
break_end:"",
lunch_start:"",
lunch_end:""

});


const [loading,setLoading]=useState(false);

const [message,setMessage]=useState("");




useEffect(()=>{

loadSettings();

},[]);






const loadSettings=async()=>{


const {data,error}=await supabase

.from("timetable_settings")

.select("*")

.eq("school_id",schoolId)

.maybeSingle();




if(error){

console.log(error);

return;

}




if(data){

setForm({

break_start:data.break_start || "",

break_end:data.break_end || "",

lunch_start:data.lunch_start || "",

lunch_end:data.lunch_end || ""

});


}



};









const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};









const saveSettings=async(e)=>{


e.preventDefault();


setLoading(true);

setMessage("");




const {data:existing}=await supabase

.from("timetable_settings")

.select("id")

.eq("school_id",schoolId)

.maybeSingle();








let response;



if(existing){


response=await supabase

.from("timetable_settings")

.update(form)

.eq("school_id",schoolId);



}

else{


response=await supabase

.from("timetable_settings")

.insert([

{

school_id:schoolId,

...form

}

]);


}






if(response.error){


setMessage(

"Error: "+response.error.message

);


setLoading(false);

return;

}






setMessage(

"Settings saved successfully ✅"

);


setLoading(false);


};









return(


<div>


<h1 className="text-3xl font-bold mb-6">

Timetable Settings

</h1>






<form

onSubmit={saveSettings}

className="bg-white shadow rounded-xl p-6 max-w-xl"

>



<h2 className="font-bold text-xl mb-4">

Break Time

</h2>




<div className="grid grid-cols-2 gap-4 mb-6">


<div>

<label>
Start Time
</label>


<input

type="time"

name="break_start"

value={form.break_start}

onChange={handleChange}

className="border p-3 rounded-lg w-full"

/>


</div>



<div>

<label>
End Time
</label>


<input

type="time"

name="break_end"

value={form.break_end}

onChange={handleChange}

className="border p-3 rounded-lg w-full"

/>


</div>


</div>









<h2 className="font-bold text-xl mb-4">

Lunch Time

</h2>





<div className="grid grid-cols-2 gap-4 mb-6">


<div>

<label>
Start Time
</label>


<input

type="time"

name="lunch_start"

value={form.lunch_start}

onChange={handleChange}

className="border p-3 rounded-lg w-full"

/>


</div>



<div>

<label>
End Time
</label>


<input

type="time"

name="lunch_end"

value={form.lunch_end}

onChange={handleChange}

className="border p-3 rounded-lg w-full"

/>


</div>


</div>







<button

disabled={loading}

className="bg-purple-600 text-white px-6 py-3 rounded-lg"

>

{

loading

?

"Saving..."

:

"Save Settings"

}


</button>






{

message &&

<div className="mt-4 bg-gray-100 p-3 rounded">

{message}

</div>

}




</form>


</div>


);


}


export default TimetableSettings;