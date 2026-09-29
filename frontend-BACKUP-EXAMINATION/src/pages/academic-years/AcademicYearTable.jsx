import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AcademicYearTable(){

  const navigate = useNavigate();


  const [years,setYears] = useState([]);

  const [loading,setLoading] = useState(true);




  const fetchYears = async()=>{


    const {data,error}=await supabase

      .from("academic_years")

      .select("*")

      .order("created_at",{ascending:false});




    if(error){

      console.log(error);

    }else{

      setYears(data || []);

    }


    setLoading(false);


  };





  useEffect(()=>{

    fetchYears();

  },[]);







  const deleteYear = async(id)=>{


    const confirm = window.confirm(
      "Delete this academic year?"
    );


    if(!confirm) return;



    const {error}=await supabase

      .from("academic_years")

      .delete()

      .eq("id",id);




    if(error){

      alert(error.message);

      return;

    }




    setYears(

      years.filter(

        year=>year.id !== id

      )

    );


  };







if(loading){

return (

<div className="bg-white p-6 rounded-xl shadow">

Loading...

</div>

);

}








return (

<div className="bg-white rounded-xl shadow mt-6 overflow-x-auto">


<table className="w-full">


<thead className="bg-slate-900 text-white">


<tr>


<th className="p-4 text-left">
Year
</th>


<th className="p-4 text-left">
Term
</th>


<th className="p-4 text-left">
Start Date
</th>


<th className="p-4 text-left">
End Date
</th>


<th className="p-4 text-left">
Status
</th>


<th className="p-4 text-center">
Action
</th>


</tr>


</thead>





<tbody>


{

years.length === 0 ?


<tr>

<td

colSpan="6"

className="p-5 text-center"

>

No Academic Years Found

</td>

</tr>


:



years.map((year)=>(



<tr

key={year.id}

className="border-b"

>


<td className="p-4">

{year.year_name}

</td>



<td className="p-4">

{year.term}

</td>



<td className="p-4">

{year.start_date || "-"}

</td>



<td className="p-4">

{year.end_date || "-"}

</td>



<td className="p-4">


{

year.is_active ?


<span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">

Active

</span>


:

<span className="bg-red-100 text-red-700 px-3 py-1 rounded-full">

Inactive

</span>


}



</td>





<td className="p-4 text-center">





<button

onClick={()=>navigate(`/academic-years/edit/${year.id}`)}

className="bg-blue-600 text-white px-4 py-2 rounded mr-2"

>

Edit

</button>






<button

onClick={()=>deleteYear(year.id)}

className="bg-red-600 text-white px-4 py-2 rounded"

>

Delete

</button>






</td>



</tr>


))


}



</tbody>


</table>


</div>


);


}



export default AcademicYearTable;