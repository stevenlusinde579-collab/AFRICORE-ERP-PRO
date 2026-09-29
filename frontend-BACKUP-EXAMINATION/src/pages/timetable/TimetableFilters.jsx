function TimetableFilters(){


return(


<div className="bg-white rounded-xl shadow p-5 mb-6">


<h2 className="font-bold text-lg mb-4">

Filters

</h2>



<div className="grid grid-cols-1 md:grid-cols-3 gap-4">



<select className="border p-3 rounded-lg">

<option>

Select Class

</option>


</select>





<select className="border p-3 rounded-lg">

<option>

Select Teacher

</option>


</select>






<select className="border p-3 rounded-lg">

<option>

Select Day

</option>


<option>

Monday

</option>


<option>

Tuesday

</option>


<option>

Wednesday

</option>


<option>

Thursday

</option>


<option>

Friday

</option>


</select>




</div>


</div>


);


}


export default TimetableFilters;