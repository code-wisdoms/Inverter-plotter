/**
 * Send function is called for every alert issued
 * 
 * @param {int}     type            1 for Server messages and 2 for inverter column updates
 * @param {string}  column_name     Server alias for type 1 and column name for type 2
 * @param {string}  message         [type 1 only] message description for type 1 alerts, null for type 2
 * @param {string}  status          [type 2 only] UP or DOWN
 * @param {float}   value           [type 2 only] current value of inverter column
 * @param {float}   old_value       [type 2 only] pervious value of inverter column
 * @param {string}  time_elapsed    [type 2 only] time elapsed since last status change of this column
 */
function send(type, column_name, message, status, value, old_value, time_elapsed) {
    //TODO write your code here
}

// Ignore this line below. This is to make send function public and expose to main module for invoking
module.exports.send = send;