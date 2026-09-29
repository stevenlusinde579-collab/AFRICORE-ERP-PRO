import { useState } from "react";
import { supabase } from "../../services/supabase";


function PeriodForm({onSaved}){


const [periodName,setPeriodName]=useState("");
const [startTime,setStartTime]=useState("");
const [endTime,setEndTime]=useState("");
const [session,setSession]=useState("Morning");



const savePeriod = async()=>{


if(!periodName || !startTime || !endTime){

alert("Fill all fields");
return;

}



const {error}=await supabase
.from("periods")
.insert([

{

school_id:1,

period_name:`Period ${periodName}`,

start_time:startTime,

end_time:endTime,

session:session

}

]);





if(error){

console.log(error);

alert(error.message);

return;

}




alert("Period saved");


setPeriodName("");
setStartTime("");
setEndTime("");



if(onSaved){

onSaved();

}


};






return(

<div className="bg-white p-5 rounded-xl shadow mb-5">


<h2 className="text-xl font-bold mb-4">
Add Period
</h2>



<div className="grid md:grid-cols-4 gap-4">


<input

className="border p-3 rounded"

placeholder="Period Number"

value={periodName}

onChange={(e)=>setPeriodName(e.target.value)}

/>




<input

type="time"

className="border p-3 rounded"

value={startTime}

onChange={(e)=>setStartTime(e.target.value)}

/>





<input

type="time"

className="border p-3 rounded"

value={endTime}

onChange={(e)=>setEndTime(e.target.value)}

/>






<select

className="border p-3 rounded"

value={session}

onChange={(e)=>setSession(e.target.value)}

>


<option value="Morning">
Morning
</option>


<option value="Evening">
Evening
</option>


</select>


</div>





<button

onClick={savePeriod}

className="mt-5 bg-blue-600 text-white px-6 py-3 rounded"

>

Save Period

</button>



</div>


);


}


export default PeriodForm;