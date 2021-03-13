<script>

export let P_all

let csvString = 'data:text/csv;charset=utf-8,'

Object.keys(P_all[0]).forEach(key => {
    csvString += key ==='rt' ? 'r_0,' : key + ','
});

csvString += 'total symptomatic, total infected'
csvString += '\r\n'

P_all.forEach(day => {
    Object.values(day).forEach((value, index) => {
        if (index === 7) {
            csvString += value.toFixed(2) + ','
        } else {
            csvString += Math.round(value) + ','
        }
    });

    const symptomatic = day.infected + day.hospitalized + day.icu
    csvString += Math.round(symptomatic) + ','
    csvString += Math.round(symptomatic + day.asymptomatic)
    csvString += '\r\n'
})

</script>

<a class="downloadModel" href={encodeURI(csvString)} download="Model Output.csv">Download Model Run</a>

<style>
    .downloadModel {
        padding: .5em 1em;
        background-color: #3273F6;
        border: 1px solid #2150ad;
        border-radius: 5px;
        color: white;
        text-decoration: none;
    }
</style>