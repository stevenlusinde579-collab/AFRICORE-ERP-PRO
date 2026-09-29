import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";


function AcademicYearStatistics(){


  const [stats,setStats]=useState({

    total:0,
    active:0,
    inactive:0,
    current:"-"

  });







  const fetchStatistics=async()=>{


    const {data,error}=await supabase

      .from("academic_years")

      .select("*");





    if(error){

      console.log(
        "STATISTICS ERROR:",
        error
      );

      return;

    }





    const total=data.length;



    const active=data.filter(

      year=>year.is_active === true

    ).length;



    const inactive=data.filter(

      year=>year.is_active === false

    ).length;





    const current=data.find(

      year=>year.is_active === true

    );






    setStats({

      total,

      active,

      inactive,

      current:

      current

      ?

      current.year_name

      :

      "-"


    });



  };






  useEffect(()=>{


    fetchStatistics();


  },[]);








return (


<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">





<div className="bg-white shadow rounded-xl p-6">


<p className="text-gray-500">

Total Academic Years

</p>


<h2 className="text-3xl font-bold text-blue-600 mt-2">

{stats.total}

</h2>


</div>






<div className="bg-white shadow rounded-xl p-6">


<p className="text-gray-500">

Active Years

</p>


<h2 className="text-3xl font-bold text-green-600 mt-2">

{stats.active}

</h2>


</div>







<div className="bg-white shadow rounded-xl p-6">


<p className="text-gray-500">

Inactive Years

</p>


<h2 className="text-3xl font-bold text-red-600 mt-2">

{stats.inactive}

</h2>


</div>







<div className="bg-white shadow rounded-xl p-6">


<p className="text-gray-500">

Current Year

</p>


<h2 className="text-xl font-bold text-purple-600 mt-2">

{stats.current}

</h2>


</div>






</div>


);


}


export default AcademicYearStatistics;