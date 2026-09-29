import { useEffect,useState } from "react";
import { supabase } from "../../services/supabase";
import PeriodForm from "./PeriodForm";


function Periods(){


const [periods,setPeriods]=useState([]);



const loadPeriods=async()=>{


const {data,error}=await supabase

.from("periods")

.select("*")

.order("start_time");




if(error){

console.log(error);

return;

}



setPeriods(data || []);



};





useEffect(()=>{

loadPeriods();

},[]);






return(

<div>


<h1 className="text-2xl font-bold mb-6">

Period Management

</h1>





<PeriodForm

onSaved={loadPeriods}

/>








<div className="bg-white rounded-xl shadow overflow-hidden">


<table className="w-full">


<thead className="bg-slate-900 text-white">


<tr>

<th className="p-3 border">

No

</th>


<th className="p-3 border">

Period

</th>


<th className="p-3 border">

Start Time

</th>


<th className="p-3 border">

End Time

</th>


<th className="p-3 border">

Session

</th>


</tr>


</thead>







<tbody>


{

periods.map((period,index)=>(


<tr key={period.id}>


<td className="p-3 border text-center">

{index+1}

</td>



<td className="p-3 border">

{period.period_name}

</td>



<td className="p-3 border">

{period.start_time}

</td>



<td className="p-3 border">

{period.end_time}

</td>



<td className="p-3 border">

{period.session}

</td>



</tr>


))


}



</tbody>



</table>


</div>





</div>


);


}


export default Periods;